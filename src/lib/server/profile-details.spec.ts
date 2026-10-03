import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { aiUsage, follow, post, profile } from './db/schema'
import { add_account, test_db, type TestDb } from './db/test-d1'
import { author_page, remove_post, set_pin } from './posts'
import { find_profile_by_handle, save_profile } from './profiles'
import { translate_post } from './translate'

let db: TestDb

const add_post = (id: string, author: string, body = id) =>
	db.insert(post).values({ id, authorId: author, body })
const pinned_of = async (user_id: string) =>
	(await db.select().from(profile).where(eq(profile.userId, user_id)))[0]?.pinnedPostId

beforeEach(async () => {
	db = test_db()
	for (const handle of ['alice', 'bob', 'carol']) await add_account(db, handle)
	// Carol follows Alice; Bob doesn't.
	await db.insert(follow).values({ followerId: 'carol', followingId: 'alice' })
})

describe('pinning a post', () => {
	it('pins only the account’s own post, and one at a time', async () => {
		await add_post('a1', 'alice')
		await add_post('a2', 'alice')
		await add_post('b1', 'bob')
		expect(await set_pin(db, 'alice', 'b1', true)).toBe(false)
		expect(await pinned_of('alice')).toBeNull()
		expect(await pinned_of('bob')).toBeNull()

		expect(await set_pin(db, 'alice', 'a1', true)).toBe(true)
		expect(await set_pin(db, 'alice', 'a2', true)).toBe(true)
		expect(await pinned_of('alice')).toBe('a2')
		// Unpinning a post that isn't the pin leaves the pin alone.
		await set_pin(db, 'alice', 'a1', false)
		expect(await pinned_of('alice')).toBe('a2')
		await set_pin(db, 'alice', 'a2', false)
		expect(await pinned_of('alice')).toBeNull()
	})

	it('shows the pin first on the Posts tab, and drops it with the post', async () => {
		await add_post('a1', 'alice')
		await add_post('a2', 'alice')
		await set_pin(db, 'alice', 'a1', true)
		const page = await author_page(db, 'bob', 'alice', false, undefined)
		expect(page.posts[0]).toMatchObject({ id: 'a1', pin_top: true, pinned: true })
		expect(page.posts.filter((p) => p.id === 'a1')).toHaveLength(2)
		expect((await author_page(db, 'bob', 'alice', true, undefined)).posts).toHaveLength(0)

		await remove_post(db, 'alice', 'a1')
		expect(await pinned_of('alice')).toBeNull()
		expect((await author_page(db, 'bob', 'alice', false, undefined)).posts[0]?.pin_top).toBe(
			undefined,
		)
	})

	it('keeps a hidden pin from people who may not see it', async () => {
		await add_post('a1', 'alice')
		await set_pin(db, 'alice', 'a1', true)
		await db.update(profile).set({ isPrivate: true }).where(eq(profile.userId, 'alice'))
		expect((await author_page(db, 'bob', 'alice', false, undefined)).posts).toHaveLength(0)
		expect((await author_page(db, 'carol', 'alice', false, undefined)).posts[0]?.pin_top).toBe(true)
	})
})

describe('location and birthday', () => {
	const save = (details: Parameters<typeof save_profile>[2]['details']) =>
		save_profile(db, 'alice', { handle: 'alice', name: 'Alice', bio: '', details })

	it('sends each viewer only the parts of the birthday they may see', async () => {
		await save({
			location: 'Phnom Penh',
			birth_date: '2000-03-05',
			birthday_audience: 'followers',
			birth_year_audience: 'only_me',
		})
		const as = async (viewer: string) => await find_profile_by_handle(db, viewer, 'alice')
		expect((await as('alice'))?.birthday).toEqual({ month: 3, day: 5, year: 2000 })
		expect((await as('carol'))?.birthday).toEqual({ month: 3, day: 5 })
		expect((await as('bob'))?.birthday).toBeUndefined()
		expect((await as('bob'))?.location).toBe('Phnom Penh')
		// No other field carries the date or the settings.
		expect(JSON.stringify(await as('carol'))).not.toContain('2000')
		expect(JSON.stringify(await as('bob'))).not.toMatch(/birth|03-05/)
	})

	it('keeps what’s saved when a form leaves the details out', async () => {
		await save({
			location: 'Tokyo',
			birth_date: '1999-12-31',
			birthday_audience: 'everyone',
			birth_year_audience: 'everyone',
		})
		await save(undefined)
		expect((await find_profile_by_handle(db, 'bob', 'alice'))?.birthday).toEqual({
			month: 12,
			day: 31,
			year: 1999,
		})
	})
})

describe('translate_post', () => {
	const workers_ai = (text: string) => {
		const calls: unknown[] = []
		const fetcher = (async (_url: string, init: RequestInit) => {
			calls.push(JSON.parse(String(init.body)))
			return Response.json({ success: true, result: { translated_text: text } })
		}) as unknown as typeof fetch
		return { calls, fetcher }
	}

	it('translates a visible post from its language into the reader’s', async () => {
		await add_post('a1', 'alice', '今日はいい天気ですね')
		const ai = workers_ai('The weather is nice today')
		expect(
			await translate_post(db, 'bob', 'a1', 'en', { enabled: true, fetcher: ai.fetcher }),
		).toEqual({ from: 'ja', text: 'The weather is nice today' })
		expect(ai.calls).toEqual([
			{ text: '今日はいい天気ですね', source_lang: 'ja', target_lang: 'en' },
		])
		expect((await db.select().from(aiUsage))[0]?.translate).toBeGreaterThan(0)
	})

	it('refuses posts the reader can’t see, or that are already in their language', async () => {
		await add_post('a1', 'alice', '今日はいい天気ですね')
		await add_post('a2', 'alice', 'Already in English here')
		await db.update(profile).set({ isPrivate: true }).where(eq(profile.userId, 'alice'))
		const ai = workers_ai('x')
		const deps = { enabled: true, fetcher: ai.fetcher }
		expect(await translate_post(db, 'bob', 'a1', 'en', deps)).toBe('not_found')
		expect(await translate_post(db, 'carol', 'a2', 'en', deps)).toBe('same_language')
		expect(await translate_post(db, 'carol', 'a1', 'en', { enabled: false })).toBe('unavailable')
		expect(ai.calls).toHaveLength(0)
	})
})
