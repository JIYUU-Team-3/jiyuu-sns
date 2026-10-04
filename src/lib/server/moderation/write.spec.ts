import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { post } from '../db/schema'
import { add_account, test_db, type TestDb } from '../db/test-d1'
import { allowance_left } from './trust'
import { check_edited_post, check_message, check_new_posts } from './write'

// No rate-limit bindings in a unit test: every lookup is under the limit.
vi.mock('../rate-limit', () => ({ limit: async () => {} }))

let db: TestDb

/** The refusal code a write check threw, or `undefined` when it let the write through. */
async function refusal(check: Promise<unknown>) {
	try {
		await check
	} catch (cause) {
		const code = (cause as { body?: { message?: string } }).body?.message
		if (code === undefined) throw cause
		return code
	}
}

const video = (n: number) => ({ kind: 'video' as const, url: `/media/posts/a/v${n}.mp4` })
const link = 'Look at https://example.com/page'

beforeEach(async () => {
	db = test_db()
	await add_account(db, 'a')
	// The resolver vouches for every host: an answer with no `0.0.0.0` record.
	vi.stubGlobal('fetch', async () => Response.json({}))
})

afterEach(() => {
	vi.unstubAllGlobals()
})

describe('new accounts', () => {
	it('post links and videos until the day’s five are used', async () => {
		for (let i = 0; i < 5; i++)
			expect(await refusal(check_new_posts(db, 'a', 'new', [{ body: link, media: [] }]))).toBe(
				undefined,
			)
		expect(await refusal(check_new_posts(db, 'a', 'new', [{ body: link, media: [] }]))).toBe(
			'link_daily_limit',
		)
		expect(await refusal(check_message(db, 'a', 'new', link))).toBe('link_daily_limit')
		// Text without a link costs nothing.
		expect(await refusal(check_message(db, 'a', 'new', 'hello'))).toBe(undefined)

		const five = [0, 1, 2, 3, 4].map(video)
		expect(await refusal(check_new_posts(db, 'a', 'new', [{ body: 'clips', media: five }]))).toBe(
			undefined,
		)
		expect(
			await refusal(check_new_posts(db, 'a', 'new', [{ body: 'one more', media: [video(5)] }])),
		).toBe('video_daily_limit')
	})

	it('pay nothing for a thread that is refused', async () => {
		// The last post links to a lookalike host (a Cyrillic а), which refuses the whole thread.
		const drafts = [
			{ body: link, media: [video(0)] },
			{ body: 'Look at https://pаypal.com', media: [] },
		]
		expect(await refusal(check_new_posts(db, 'a', 'new', drafts))).toBe('link_lookalike')
		expect(await allowance_left(db, 'a')).toEqual({ links: 5, videos: 5 })
		const six = [0, 1, 2, 3, 4, 5].map(video)
		expect(await refusal(check_new_posts(db, 'a', 'new', [{ body: link, media: six }]))).toBe(
			'video_daily_limit',
		)
		expect(await allowance_left(db, 'a')).toEqual({ links: 5, videos: 5 })
	})

	it('pay for an edit only when it adds a link', async () => {
		await db.insert(post).values({ id: 'p', authorId: 'a', body: link })
		expect(await refusal(check_edited_post(db, 'a', 'new', 'p', `${link} (edited)`))).toBe(
			undefined,
		)
		expect((await allowance_left(db, 'a')).links).toBe(5)
		await refusal(check_edited_post(db, 'a', 'new', 'p', `${link} and https://example.org`))
		expect((await allowance_left(db, 'a')).links).toBe(4)
		// Someone else's post id is nothing to edit, and nothing to pay for.
		await add_account(db, 'b')
		await db.update(post).set({ authorId: 'b' }).where(eq(post.id, 'p'))
		await refusal(check_edited_post(db, 'a', 'new', 'p', 'https://example.net'))
		expect((await allowance_left(db, 'a')).links).toBe(4)
	})
})

describe('restricted accounts', () => {
	it('still can’t post links or video at all', async () => {
		expect(await refusal(check_new_posts(db, 'a', 'restricted', [{ body: link, media: [] }]))).toBe(
			'link_new_account',
		)
		expect(
			await refusal(check_new_posts(db, 'a', 'restricted', [{ body: 'x', media: [video(0)] }])),
		).toBe('video_new_account')
		expect(await refusal(check_message(db, 'a', 'restricted', link))).toBe('link_new_account')
		expect(await allowance_left(db, 'a')).toEqual({ links: 5, videos: 5 })
	})
})

describe('other accounts', () => {
	it('have no daily allowance', async () => {
		const six = [0, 1, 2, 3, 4, 5].map(video)
		for (let i = 0; i < 6; i++)
			expect(
				await refusal(check_new_posts(db, 'a', 'normal', [{ body: `${link} ${i}`, media: six }])),
			).toBe(undefined)
		expect(await allowance_left(db, 'a')).toEqual({ links: 5, videos: 5 })
	})
})
