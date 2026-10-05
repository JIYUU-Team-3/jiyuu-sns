import { beforeEach, describe, expect, it, vi } from 'vitest'
import { and, eq } from 'drizzle-orm'
import { follow, notification, post } from './db/schema'
import { add_account, test_db, type TestDb } from './db/test-d1'
import { remove_follower, set_follow, set_post_alerts } from './follows'
import { announce_post, POST_ALERTS_MAX } from './notifications'
import { insert_thread } from './posts'
import { set_block, set_mute } from './safety'

// Pushes go out through the Worker's own runtime, which a unit test doesn't have.
vi.mock('cloudflare:workers', () => ({ env: {}, waitUntil: () => {} }))

describe('alerts for new posts', () => {
	let db: TestDb

	/** Who was told `post_id` is new, by id. */
	async function told(post_id: string) {
		const rows = await db
			.select({ user_id: notification.userId })
			.from(notification)
			.where(and(eq(notification.postId, post_id), eq(notification.type, 'post')))
			.orderBy(notification.userId)
		return rows.map((row) => row.user_id)
	}

	async function write(
		author: string,
		body: string,
		options: { quote?: string; reply?: string } = {},
	) {
		const ids = await insert_thread(
			db,
			author,
			[{ body, media: [], quote: options.quote }],
			options.reply,
		)
		if (!Array.isArray(ids)) throw new Error(`not written: ${ids}`)
		return ids[0]
	}

	async function alerts_on(follower: string) {
		return (await db.select().from(follow).where(eq(follow.followerId, follower))).map(
			(row) => row.notifyPosts,
		)
	}

	beforeEach(async () => {
		db = test_db()
		for (const handle of ['olive', 'adam', 'mia', 'eve']) await add_account(db, handle)
		await set_follow(db, 'adam', 'olive', true)
		await set_follow(db, 'mia', 'olive', true)
		await set_post_alerts(db, 'adam', 'olive', true)
	})

	it('tells only the followers who asked, about a post and a quote', async () => {
		const first = await write('olive', 'hello')
		await announce_post(db, first)
		expect(await told(first)).toEqual(['adam'])

		const other = await write('eve', 'something')
		const quote = await write('olive', 'look', { quote: other })
		await announce_post(db, quote)
		expect(await told(quote)).toEqual(['adam'])
	})

	it('says nothing about a reply or a hidden post', async () => {
		const first = await write('eve', 'question')
		const reply = await write('olive', 'answer', { reply: first })
		await announce_post(db, reply)
		expect(await told(reply)).toEqual([])

		const hidden = await write('olive', 'hidden')
		await db.update(post).set({ moderation: 'limited' }).where(eq(post.id, hidden))
		await announce_post(db, hidden)
		expect(await told(hidden)).toEqual([])
	})

	it("can't be turned on without following", async () => {
		expect(await set_post_alerts(db, 'eve', 'olive', true)).toBe(false)
		expect(await alerts_on('eve')).toEqual([])
	})

	it('ends with the follow: unfollow, removed follower, block', async () => {
		await set_follow(db, 'adam', 'olive', false)
		await set_follow(db, 'adam', 'olive', true)
		expect(await alerts_on('adam')).toEqual([false])

		await set_post_alerts(db, 'adam', 'olive', true)
		await remove_follower(db, 'olive', 'adam')
		await set_follow(db, 'adam', 'olive', true)
		expect(await alerts_on('adam')).toEqual([false])

		await set_post_alerts(db, 'adam', 'olive', true)
		await set_block(db, 'olive', 'adam', true)
		expect(await alerts_on('adam')).toEqual([])
	})

	it('leaves out a follower who muted the author', async () => {
		await set_post_alerts(db, 'mia', 'olive', true)
		await set_mute(db, 'mia', 'olive', true)
		const first = await write('olive', 'hello')
		await announce_post(db, first)
		expect(await told(first)).toEqual(['adam'])
	})

	it(`tells at most ${POST_ALERTS_MAX} followers`, async () => {
		const crowd = Array.from({ length: POST_ALERTS_MAX + 1 }, (_, i) => `fan${i}`)
		for (const handle of crowd) {
			await add_account(db, handle)
			await set_follow(db, handle, 'eve', true)
			await set_post_alerts(db, handle, 'eve', true)
		}
		const first = await write('eve', 'hello')
		await announce_post(db, first)
		expect(await told(first)).toHaveLength(POST_ALERTS_MAX)
	})
})
