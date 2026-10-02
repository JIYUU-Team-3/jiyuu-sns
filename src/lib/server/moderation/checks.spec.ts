import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { aiUsage, moderationCase, post, postMedia, user } from '../db/schema'
import { add_account, test_db, type TestDb } from '../db/test-d1'
import { check_post, type CheckDeps } from './checks'

let db: TestDb
const DAY = 24 * 60 * 60 * 1000

/** A fake Workers AI: Llama Guard answers `guard`, the vision model answers `vision`. */
function workers_ai(guard: string, vision = '{"nudity":0,"violence":0,"gore":0}', status = 200) {
	return vi.fn(async (input: string | URL | Request) => {
		const model = String(input).includes('vision') ? 'vision' : 'guard'
		if (status !== 200) {
			return new Response(JSON.stringify({ success: false, errors: [{ code: status }] }), {
				status: 429,
			})
		}
		return Response.json({
			success: true,
			result: {
				response: model === 'vision' ? vision : guard,
				usage: { prompt_tokens: 400, completion_tokens: 3 },
			},
		})
	}) as unknown as typeof fetch
}

/** A fake R2 bucket that holds one small PNG at every key. */
const bucket = {
	get: async () => ({
		size: 100,
		httpMetadata: { contentType: 'image/png' },
		arrayBuffer: async () => new Uint8Array([137, 80, 78, 71]).buffer,
	}),
} as unknown as R2Bucket

const deps = (fetcher: typeof fetch, random = () => 0): CheckDeps => ({
	bucket,
	enabled: true,
	fetcher,
	random,
})

async function age(handle: string, days: number, posts: number) {
	await add_account(db, handle)
	await db
		.update(user)
		.set({ createdAt: new Date(Date.now() - days * DAY) })
		.where(eq(user.id, handle))
	for (let i = 0; i < posts; i++) {
		await db.insert(post).values({ id: `${handle}-old-${i}`, authorId: handle, body: `old ${i}` })
	}
}

async function add_post(id: string, author: string, body: string, image = false) {
	await db.insert(post).values({ id, authorId: author, body, checked: 'pending' })
	if (image) {
		await db.insert(postMedia).values({
			postId: id,
			position: 0,
			kind: 'image',
			url: `/media/posts/${author}/a.png`,
			width: 1,
			height: 1,
		})
	}
}

const state = async (id: string) => (await db.select().from(post).where(eq(post.id, id)))[0]
const cases = () => db.select().from(moderationCase)

beforeEach(async () => {
	db = test_db()
	await age('newbie', 1, 0)
	await age('regular', 10, 5)
	await age('veteran', 40, 25)
})

describe('check_post', () => {
	it('skips everything while Workers AI is off', async () => {
		await add_post('p', 'newbie', 'Some English words to check')
		expect(await check_post(db, { bucket, enabled: false }, 'p')).toBe('skipped')
	})

	it('hides a new account’s hateful post for a moderator', async () => {
		await add_post('p', 'newbie', 'Some hateful English words here')
		expect(await check_post(db, deps(workers_ai('unsafe\nS10')), 'p')).toBe('checked')
		expect(await state('p')).toMatchObject({ moderation: 'limited', checked: 'checked' })
		const [item] = await cases()
		expect(item).toMatchObject({ targetId: 'p', reason: 'hate' })
		expect(JSON.parse(item.flags)).toEqual({ text: ['S10'] })
	})

	it('only raises the case for an established account, except for child safety', async () => {
		await add_post('p', 'regular', 'Some hateful English words here')
		await check_post(db, deps(workers_ai('unsafe\nS10')), 'p')
		expect((await state('p')).moderation).toBe('visible')
		expect(await cases()).toHaveLength(1)

		await add_post('q', 'regular', 'Something far worse in English')
		await check_post(db, deps(workers_ai('unsafe\nS4')), 'q')
		expect((await state('q')).moderation).toBe('limited')
	})

	it('passes a safe post and leaves non-English text to people', async () => {
		const ai = workers_ai('safe')
		await add_post('p', 'newbie', 'A perfectly normal post about lunch')
		await add_post('q', 'newbie', '今日はいい天気ですね')
		expect(await check_post(db, deps(ai), 'p')).toBe('checked')
		expect(await check_post(db, deps(ai), 'q')).toBe('skipped')
		expect(ai).toHaveBeenCalledOnce()
		expect(await cases()).toEqual([])
	})

	it('leaves a post unchecked when Workers AI fails, and stops for the day at the quota', async () => {
		await add_post('p', 'newbie', 'Some English words to check')
		expect(await check_post(db, deps(workers_ai('', undefined, 4006)), 'p')).toBe('unchecked')
		const [usage] = await db.select().from(aiUsage)
		expect(usage.text).toBeGreaterThan(5000)
	})

	it('gives back the reservation when a call fails for another reason', async () => {
		await add_post('p', 'newbie', 'Some English words to check')
		expect(await check_post(db, deps(workers_ai('', undefined, 500)), 'p')).toBe('unchecked')
		const [usage] = await db.select().from(aiUsage)
		expect(usage.text).toBe(0)
	})

	it('blurs a suggestive image and hides an explicit one', async () => {
		await add_post('p', 'newbie', '', true)
		await check_post(db, deps(workers_ai('safe', '{"nudity":2,"violence":0,"gore":0}')), 'p')
		expect(await state('p')).toMatchObject({ sensitive: true, moderation: 'visible' })

		await add_post('q', 'newbie', '', true)
		await check_post(db, deps(workers_ai('safe', '{"nudity":3,"violence":0,"gore":0}')), 'q')
		expect(await state('q')).toMatchObject({ sensitive: true, moderation: 'limited' })
	})

	it('looks at images by trust: all of a new account’s, some of a normal one’s, none of a trusted one’s', async () => {
		const ai = workers_ai('safe', '{"nudity":0,"violence":0,"gore":0}')
		await add_post('v', 'veteran', '', true)
		await add_post('r', 'regular', '', true)
		expect(
			await check_post(
				db,
				deps(ai, () => 0.9),
				'v',
			),
		).toBe('skipped')
		expect(
			await check_post(
				db,
				deps(ai, () => 0.9),
				'r',
			),
		).toBe('skipped')
		expect(
			await check_post(
				db,
				deps(ai, () => 0.1),
				'r',
			),
		).toBe('checked')
		// A report looks at everything.
		expect(
			await check_post(
				db,
				deps(ai, () => 0.9),
				'v',
				'report',
			),
		).toBe('checked')
	})
})
