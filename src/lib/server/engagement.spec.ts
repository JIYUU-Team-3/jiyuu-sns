import { beforeEach, describe, expect, it } from 'vitest'
import { block, bookmark, follow, mute, post, postLike, profile, repost } from './db/schema'
import { add_account, test_db, type TestDb } from './db/test-d1'
import {
	author_page,
	feed_page,
	find_post,
	insert_post,
	likes_page,
	PAGE_SIZE,
	set_bookmark,
	set_repost,
	type NewPost,
} from './posts'
import { eq } from 'drizzle-orm'

const text = (body: string): NewPost => ({ body, media: [] })

describe('reposts, quotes, likes and bookmarks across privacy, blocks and mutes', () => {
	let db: TestDb

	const add_post = (id: string, author: string, extra = {}) =>
		db.insert(post).values({ id, authorId: author, body: id, ...extra })
	const go_private = (handle: string) =>
		db.update(profile).set({ isPrivate: true }).where(eq(profile.userId, handle))
	const quoted = async (viewer: string, id: string) =>
		(await find_post(db, viewer, id))?.quote?.post?.id

	beforeEach(async () => {
		db = test_db()
		for (const handle of ['alice', 'bob', 'carol', 'dave']) await add_account(db, handle)
		// Carol follows Alice; Dave doesn't.
		await db.insert(follow).values({ followerId: 'carol', followingId: 'alice' })
	})

	it('shows a quoted post only to people who may see it', async () => {
		await add_post('a1', 'alice')
		const quote = await insert_post(db, 'bob', { ...text('q'), quote: 'a1' }, undefined)
		expect(typeof quote).toBe('string')
		const id = quote as string
		expect(await quoted('dave', id)).toBe('a1')

		await go_private('alice')
		expect(await quoted('dave', id)).toBeUndefined()
		expect(await quoted('carol', id)).toBe('a1')
		expect(await quoted('alice', id)).toBe('a1')
		// The quote still says it quotes something, so the card reads "unavailable".
		expect((await find_post(db, 'dave', id))?.quote?.id).toBe('a1')

		await db.update(profile).set({ isPrivate: false }).where(eq(profile.userId, 'alice'))
		await db.insert(block).values({ blockerId: 'alice', blockedId: 'dave' })
		expect(await quoted('dave', id)).toBeUndefined()

		await db.update(post).set({ moderation: 'removed' }).where(eq(post.id, 'a1'))
		expect(await quoted('bob', id)).toBeUndefined()
		expect(await quoted('alice', id)).toBe('a1')
	})

	it('refuses to quote or repost a private account’s post, except its own', async () => {
		await add_post('a1', 'alice')
		await go_private('alice')
		expect(await insert_post(db, 'carol', { ...text('q'), quote: 'a1' }, undefined)).toBe('private')
		expect(await set_repost(db, 'carol', 'a1', true)).toBe(false)
		expect(await db.select().from(repost)).toEqual([])
		// Someone who can't see it at all learns nothing more than that it isn't there.
		expect(await insert_post(db, 'dave', { ...text('q'), quote: 'a1' }, undefined)).toBe(undefined)

		expect(typeof (await insert_post(db, 'alice', { ...text('q'), quote: 'a1' }, undefined))).toBe(
			'string',
		)
		expect(await set_repost(db, 'alice', 'a1', true)).toBe(true)
		expect(await db.select().from(repost)).toHaveLength(1)
	})

	it('keeps a private account’s reposts to its followers', async () => {
		await add_post('b1', 'bob')
		await db.insert(repost).values({ userId: 'alice', postId: 'b1' })
		await go_private('alice')
		const reposts = async (viewer: string) =>
			(await author_page(db, viewer, 'alice', false, undefined)).posts.map((view) => view.id)
		expect(await reposts('dave')).toEqual([])
		expect(await reposts('carol')).toEqual(['b1'])
	})

	it('leaves reposts by a muted account out of the Following feed', async () => {
		await add_post('d1', 'dave')
		await db.insert(follow).values({ followerId: 'bob', followingId: 'alice' })
		await db.insert(repost).values({ userId: 'alice', postId: 'd1' })
		const feed = async () =>
			(await feed_page(db, 'bob', 'following', undefined)).posts.map((view) => view.id)
		expect(await feed()).toEqual(['d1'])
		await db.insert(mute).values({ muterId: 'bob', mutedId: 'alice' })
		expect(await feed()).toEqual([])
	})

	it('won’t bookmark a post the viewer can’t see', async () => {
		await add_post('a1', 'alice')
		await go_private('alice')
		await set_bookmark(db, 'dave', 'a1', true)
		expect(await db.select().from(bookmark)).toEqual([])
		await set_bookmark(db, 'carol', 'a1', true)
		expect(await db.select().from(bookmark)).toHaveLength(1)
	})

	it('shows someone’s likes only as far as they are open to the viewer', async () => {
		const liked = async (viewer: string) =>
			(await likes_page(db, viewer, 'alice', undefined)).posts.map((found) => found.id)
		await add_post('b1', 'bob')
		await db.insert(postLike).values({ userId: 'alice', postId: 'b1' })
		expect(await liked('dave')).toEqual(['b1'])

		await go_private('alice')
		expect(await liked('dave')).toEqual([])
		expect(await liked('carol')).toEqual(['b1'])
		expect(await liked('alice')).toEqual(['b1'])

		await db.update(profile).set({ isPrivate: false }).where(eq(profile.userId, 'alice'))
		await db.insert(block).values({ blockerId: 'alice', blockedId: 'dave' })
		expect(await liked('dave')).toEqual([])
	})

	it('fills a page of likes with posts the viewer may see, and pages past the rest', async () => {
		// Dave's account is private and Carol doesn't follow it, so his post is hidden from her.
		await go_private('dave')
		const total = PAGE_SIZE + 2
		const hidden = 'p3'
		for (let i = 1; i <= total; i++) {
			await add_post(`p${i}`, `p${i}` === hidden ? 'dave' : 'bob')
			await db.insert(postLike).values({ userId: 'alice', postId: `p${i}`, createdAt: new Date(i) })
		}
		const first = await likes_page(db, 'carol', 'alice', undefined)
		expect(first.posts).toHaveLength(PAGE_SIZE)
		expect(first.posts.map((found) => found.id)).not.toContain(hidden)
		expect(first.next).toBeDefined()
		expect(first.next).not.toContain(hidden)

		const second = await likes_page(db, 'carol', 'alice', first.next)
		expect(second.posts.map((found) => found.id)).toEqual(['p1'])
		expect(second.next).toBeUndefined()
	})
})
