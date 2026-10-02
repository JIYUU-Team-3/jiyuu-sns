import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
	accountStanding,
	appeal,
	moderationAction,
	notification,
	post,
	postLike,
	postMedia,
	postTag,
} from '../db/schema'
import { add_account, test_db, type TestDb } from '../db/test-d1'
import { author_page, feed_page, find_post, replies_page, remove_post, set_like } from '../posts'
import { search_posts, trending_tags } from '../search'
import { find_standing } from './standing'
import {
	media_shown_to,
	moderate_post,
	post_notice,
	purge_removed_posts,
	REMOVED_KEPT_MS,
	refuse_removal_review,
	request_post_review,
	uphold_removal_review,
} from './posts'

let db: TestDb
const now = Date.now()

async function add_post(
	id: string,
	author: string,
	body: string,
	extra: Partial<typeof post.$inferInsert> = {},
) {
	await db
		.insert(post)
		.values({ id, authorId: author, body, createdAt: new Date(now - 1000), ...extra })
}

beforeEach(async () => {
	db = test_db()
	for (const handle of ['mod', 'alice', 'bob']) await add_account(db, handle)
	await db.insert(accountStanding).values({ userId: 'mod', role: 'moderator' })
	await add_post('p1', 'alice', 'hello #news')
	await db.insert(postTag).values({ postId: 'p1', tag: 'news', createdAt: new Date(now - 1000) })
	await db.insert(postMedia).values({
		postId: 'p1',
		position: 0,
		kind: 'image',
		url: '/media/posts/alice/a.jpg',
		width: 1,
		height: 1,
	})
})

const remove = (extra: { strike?: boolean; reason?: 'spam' | 'threat' } = {}) =>
	moderate_post(db, {
		moderator_id: 'mod',
		post_id: 'p1',
		action: 'remove',
		reason: extra.reason ?? 'spam',
		strike: extra.strike ?? true,
	})

describe('a removed post', () => {
	it('stays removed when a limit read it as visible just before the removal', async () => {
		// The limit's read happened before the removal landed; only its write comes after.
		const stale = [{ author_id: 'alice', moderation: 'visible', sensitive: false }]
		const read = { from: () => read, where: () => read, limit: async () => stale }
		await remove()
		vi.spyOn(db, 'select').mockReturnValueOnce(read as never)
		const limited = await moderate_post(db, {
			moderator_id: null,
			post_id: 'p1',
			action: 'limit',
			reason: 'spam',
		})
		expect(limited).toBeUndefined()
		expect((await find_post(db, 'alice', 'p1'))?.moderation).toBe('removed')
		const actions = await db.select({ action: moderationAction.action }).from(moderationAction)
		expect(actions).toEqual([{ action: 'remove' }])
	})

	it('stays removed when a late automatic check would only limit it', async () => {
		await remove()
		expect(
			await moderate_post(db, {
				moderator_id: null,
				post_id: 'p1',
				action: 'limit',
				reason: 'spam',
			}),
		).toBeUndefined()
		expect((await find_post(db, 'alice', 'p1'))?.moderation).toBe('removed')
	})

	it('is gone for everyone but its author', async () => {
		await remove()
		expect(await find_post(db, 'bob', 'p1')).toBeUndefined()
		expect(await find_post(db, undefined, 'p1')).toBeUndefined()
		expect((await find_post(db, 'alice', 'p1'))?.moderation).toBe('removed')

		expect((await feed_page(db, 'bob', 'for_you', undefined)).posts).toEqual([])
		expect((await author_page(db, 'bob', 'alice', false, undefined)).posts).toEqual([])
		expect((await author_page(db, 'alice', 'alice', false, undefined)).posts).toHaveLength(1)
		expect((await search_posts(db, 'bob', 'hello', 'latest', undefined)).posts).toEqual([])
		expect((await search_posts(db, 'bob', 'hello', 'top', undefined)).posts).toEqual([])
		expect((await search_posts(db, 'bob', '#news', 'latest', undefined)).posts).toEqual([])
		expect(await trending_tags(db, 5)).toEqual([])
	})

	it('hides its media from others', async () => {
		expect(await media_shown_to(db, '/media/posts/alice/a.jpg', 'bob')).toBe(true)
		await remove()
		expect(await media_shown_to(db, '/media/posts/alice/a.jpg', 'bob')).toBe(false)
		expect(await media_shown_to(db, '/media/posts/alice/a.jpg', 'alice')).toBe(true)
	})

	it('takes no likes from others, and its hidden replies are not counted', async () => {
		await add_post('r1', 'bob', 'a reply', { replyToId: 'p1', isReply: true })
		expect((await find_post(db, 'alice', 'p1'))?.replies).toBe(1)
		await moderate_post(db, { moderator_id: 'mod', post_id: 'r1', action: 'limit' })
		expect((await find_post(db, 'alice', 'p1'))?.replies).toBe(0)
		expect((await replies_page(db, 'alice', 'p1', undefined)).posts).toEqual([])

		await remove()
		await set_like(db, 'bob', 'p1', true)
		expect(await db.select().from(postLike)).toEqual([])
	})

	it('tells its author why, once', async () => {
		await remove()
		expect(await remove()).toBeUndefined()
		const notes = await db.select().from(notification).where(eq(notification.userId, 'alice'))
		expect(notes).toHaveLength(1)
		expect(notes[0]).toMatchObject({ type: 'moderation', postId: 'p1' })
		expect(await post_notice(db, 'alice', 'p1')).toMatchObject({ action: 'remove', reason: 'spam' })
		// Someone else learns nothing about it.
		expect(await post_notice(db, 'bob', 'p1')).toBeUndefined()
	})
})

describe('strikes', () => {
	it('suspend the author at the third inside the window', async () => {
		await add_post('p2', 'alice', 'two')
		await add_post('p3', 'alice', 'three')
		await remove()
		await moderate_post(db, {
			moderator_id: 'mod',
			post_id: 'p2',
			action: 'remove',
			reason: 'spam',
			strike: true,
		})
		expect((await find_standing(db, 'alice')).suspension).toBeUndefined()
		const third = await moderate_post(db, {
			moderator_id: 'mod',
			post_id: 'p3',
			action: 'remove',
			reason: 'spam',
			strike: true,
		})
		expect(third?.suspended).toBe('suspend')
		expect((await find_standing(db, 'alice')).suspension?.until).toBeGreaterThan(now)
	})

	it('ban at once for a never-allowed rule', async () => {
		expect((await remove({ reason: 'threat' }))?.suspended).toBe('ban')
		expect((await find_standing(db, 'alice')).suspension?.until).toBeNull()
	})

	it('still suspend when telling the author fails', async () => {
		const insert = db.insert.bind(db)
		vi.spyOn(db, 'insert').mockImplementation(((table: Parameters<typeof insert>[0]) => {
			if (table === notification) throw new Error('notification failed')
			return insert(table)
		}) as typeof db.insert)
		await expect(remove({ reason: 'threat' })).rejects.toThrow('notification failed')
		vi.restoreAllMocks()
		expect((await find_standing(db, 'alice')).suspension?.until).toBeNull()
	})

	it('go when the post is restored', async () => {
		await remove()
		await moderate_post(db, { moderator_id: 'mod', post_id: 'p1', action: 'restore' })
		expect((await find_post(db, 'bob', 'p1'))?.moderation).toBeUndefined()
		expect(await post_notice(db, 'alice', 'p1')).toBeUndefined()
	})

	it('are not counted for a removal without one', async () => {
		await remove({ strike: false })
		await add_post('p2', 'alice', 'two')
		await add_post('p3', 'alice', 'three')
		for (const id of ['p2', 'p3']) {
			await moderate_post(db, {
				moderator_id: 'mod',
				post_id: id,
				action: 'remove',
				reason: 'spam',
				strike: true,
			})
		}
		expect((await find_standing(db, 'alice')).suspension).toBeUndefined()
	})
})

describe('reviews of a removal', () => {
	it('can be asked for once, by the author, within the day', async () => {
		await remove()
		expect(await request_post_review(db, 'bob', 'p1', 'not mine')).toBe(false)
		expect(await request_post_review(db, 'alice', 'p1', 'late', now + REMOVED_KEPT_MS + 1000)).toBe(
			false,
		)
		expect(await request_post_review(db, 'alice', 'p1', 'please')).toBe(true)
		expect(await request_post_review(db, 'alice', 'p1', 'again')).toBe(false)
	})
})

describe('purge_removed_posts', () => {
	it('deletes a removed post after its day, unless a review is pending', async () => {
		await remove()
		expect((await purge_removed_posts(db, now)).purged).toBe(0)

		await request_post_review(db, 'alice', 'p1', 'please')
		expect((await purge_removed_posts(db, now + REMOVED_KEPT_MS + 1000)).purged).toBe(0)

		await db.update(appeal).set({ status: 'refused' })
		const result = await purge_removed_posts(db, now + REMOVED_KEPT_MS + 1000)
		expect(result).toEqual({ purged: 1, unused: ['/media/posts/alice/a.jpg'] })
		expect(await db.select().from(post)).toEqual([])
	})

	it('re-checks at the delete, so a post restored after it was picked stays', async () => {
		await remove()
		await moderate_post(db, { moderator_id: 'mod', post_id: 'p1', action: 'restore' })
		// The purge picked p1 while it was removed; by its delete the post is visible again.
		expect(await remove_post(db, 'alice', 'p1', eq(post.moderation, 'removed'))).toBeUndefined()
		expect(await db.select({ id: post.id }).from(post)).toEqual([{ id: 'p1' }])
	})

	it('leaves visible and limited posts alone', async () => {
		await moderate_post(db, { moderator_id: 'mod', post_id: 'p1', action: 'limit' })
		expect((await purge_removed_posts(db, now + 10 * REMOVED_KEPT_MS)).purged).toBe(0)
	})
})

describe('deciding a removal review', () => {
	it('acts on the removal it was about, never a newer one', async () => {
		const old = (await remove())!.action_id
		await moderate_post(db, { moderator_id: 'mod', post_id: 'p1', action: 'restore' })
		const current = (await remove())!.action_id

		// The old removal was already undone: upholding or refusing it changes nothing.
		expect(await refuse_removal_review(db, 'p1', old)).toEqual([])
		await uphold_removal_review(db, 'mod', 'p1', old)
		expect((await find_post(db, 'alice', 'p1'))?.moderation).toBe('removed')

		await uphold_removal_review(db, 'mod', 'p1', current)
		expect((await find_post(db, 'bob', 'p1'))?.moderation).toBeUndefined()
	})

	it('keeps a post whose review was upheld out of the purge', async () => {
		await remove()
		await request_post_review(db, 'alice', 'p1', 'please')
		await db.update(appeal).set({ status: 'upheld' })
		expect((await purge_removed_posts(db, now + 2 * REMOVED_KEPT_MS)).purged).toBe(0)
	})
})
