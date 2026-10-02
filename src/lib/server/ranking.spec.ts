import { beforeEach, describe, expect, it } from 'vitest'
import { accountStanding, follow, moderationCase, post, postLike, user } from './db/schema'
import { add_account, test_db, type TestDb } from './db/test-d1'
import { feed_page, PAGE_SIZE } from './posts'
import { hot_score, new_score, rising_score, SLOTS, slotted, type Signals } from './ranking'

const HOUR = 60 * 60 * 1000
const now = Date.now()

const signals = (id: string, hours_old: number, extra: Partial<Signals> = {}): Signals => ({
	id,
	created_at: now - hours_old * HOUR,
	likes: 0,
	replies: 0,
	followed: false,
	mine: false,
	earlier: 0,
	behaviour: 0,
	reports: 0,
	...extra,
})

describe('scores', () => {
	it('let a liked post outlast an empty newer one, for a while', () => {
		const liked = signals('liked', 12, { likes: 7 })
		expect(hot_score(liked, now)).toBeGreaterThan(hot_score(signals('new', 0), now))
		const stale = signals('stale', 24, { likes: 7 })
		expect(hot_score(stale, now)).toBeLessThan(hot_score(signals('new', 0), now))
	})

	it('lower a flooded, reported or badly scored post in every list', () => {
		const clean = signals('clean', 1, { likes: 3 })
		for (const spam of [{ earlier: 4 }, { reports: 2 }, { behaviour: 60 }]) {
			const marked = { ...clean, ...spam }
			expect(hot_score(marked, now)).toBeLessThan(hot_score(clean, now))
			expect(new_score(marked, now)).toBeLessThan(new_score(clean, now))
			expect(rising_score(marked, now)).toBeLessThan(rising_score(clean, now)!)
		}
	})

	it('cap what flooding and reports can cost', () => {
		expect(new_score(signals('a', 0, { earlier: 50, reports: 50 }), now)).toBe(-10)
	})

	it('call a post rising only when it is young, noticed and from a stranger', () => {
		expect(rising_score(signals('a', 1, { likes: 1 }), now)).toBe(1)
		expect(rising_score(signals('a', 1), now)).toBeUndefined()
		expect(rising_score(signals('a', 4, { likes: 9 }), now)).toBeUndefined()
		expect(rising_score(signals('a', 1, { likes: 9, followed: true }), now)).toBeUndefined()
		expect(rising_score(signals('a', 1, { likes: 9, mine: true }), now)).toBeUndefined()
	})
})

describe('slotted', () => {
	it('deals new, hot and rising posts into their slots, each post once', () => {
		const candidates = [
			signals('new1', 0.1),
			signals('new2', 0.2),
			signals('new3', 0.3),
			signals('hot1', 20, { likes: 200 }),
			signals('hot2', 20, { likes: 100 }),
			signals('rising', 2, { likes: 2 }),
		]
		expect(SLOTS).toEqual(['new', 'hot', 'new', 'hot', 'rising'])
		expect(slotted(candidates, now)).toEqual(['new1', 'hot1', 'new2', 'hot2', 'rising', 'new3'])
	})

	it('fills a slot from the hot list when its own has run out', () => {
		const candidates = [signals('a', 1), signals('b', 2), signals('c', 3, { likes: 50 })]
		// Nothing is rising, and every post is placed once.
		expect(slotted(candidates, now)).toEqual(['a', 'c', 'b'])
		expect(slotted([], now)).toEqual([])
	})
})

describe('the For you feed', () => {
	let db: TestDb

	const add_post = (id: string, author: string, hours_old: number, extra = {}) =>
		db.insert(post).values({
			id,
			authorId: author,
			body: id,
			createdAt: new Date(now - hours_old * HOUR - 1000),
			...extra,
		})

	const ids = async (viewer: string, cursor?: string) =>
		(await feed_page(db, viewer, 'for_you', cursor)).posts.map((view) => view.id)

	beforeEach(async () => {
		db = test_db()
		for (const handle of ['alice', 'bob', 'carol', 'dave']) await add_account(db, handle)
		// Everyone here is past their first days, so their likes count.
		await db.update(user).set({ createdAt: new Date(now - 30 * 24 * HOUR) })
	})

	it('shows a new post first and keeps a popular older one near the top', async () => {
		await add_post('old-liked', 'alice', 10)
		await add_post('old-plain', 'alice', 9)
		await add_post('fresh', 'carol', 0)
		for (const liker of ['carol', 'dave']) {
			await db.insert(postLike).values({ postId: 'old-liked', userId: liker })
		}
		expect(await ids('bob')).toEqual(['fresh', 'old-liked', 'old-plain'])
	})

	it('does not count an author’s own like or replies, or likes from throwaway accounts', async () => {
		await add_post('boosted', 'alice', 10)
		await add_post('plain', 'carol', 9)
		await add_post('newest', 'carol', 0)
		await db.insert(postLike).values({ postId: 'boosted', userId: 'alice' })
		await add_post('self-reply', 'alice', 1, { replyToId: 'boosted', isReply: true })
		await add_account(db, 'sock')
		await db.insert(postLike).values({ postId: 'boosted', userId: 'sock' })
		await db.insert(accountStanding).values({ userId: 'dave', restricted: true })
		await db.insert(postLike).values({ postId: 'boosted', userId: 'dave' })
		// With nothing counted, the newer plain post stays ahead in the hot slot.
		expect(await ids('bob')).toEqual(['newest', 'plain', 'boosted'])
		// One like from a settled account in good standing is enough to pass it.
		await db.insert(postLike).values({ postId: 'boosted', userId: 'carol' })
		expect(await ids('bob')).toEqual(['newest', 'boosted', 'plain'])
	})

	it('sinks a flood of posts below one post from someone else', async () => {
		for (const n of [5, 4, 3, 2, 1]) await add_post(`flood${n}`, 'alice', n / 10)
		await add_post('single', 'carol', 1)
		const order = await ids('bob')
		expect(order.indexOf('single')).toBeLessThan(order.indexOf('flood2'))
		expect(order[0]).toBe('flood5')
	})

	it('sinks a reported post and one from a badly scored account', async () => {
		await add_post('reported', 'alice', 0)
		await add_post('scored', 'carol', 0)
		await add_post('clean', 'dave', 5)
		await db
			.insert(moderationCase)
			.values({ targetKind: 'post', targetId: 'reported', targetUserId: 'alice', reports: 3 })
		await db.insert(accountStanding).values({ userId: 'carol', behaviourScore: 50 })
		expect((await ids('bob'))[0]).toBe('clean')
	})

	it('leaves out a restricted account, except for its followers and itself', async () => {
		await add_post('p', 'alice', 0)
		await db.insert(accountStanding).values({ userId: 'alice', restricted: true })
		await db.insert(follow).values({ followerId: 'carol', followingId: 'alice' })
		expect(await ids('bob')).toEqual([])
		expect(await ids('carol')).toEqual(['p'])
		expect(await ids('alice')).toEqual(['p'])
	})

	it('pages through every post once', async () => {
		for (let n = 0; n < PAGE_SIZE + 5; n++) await add_post(`p${n}`, n % 2 ? 'alice' : 'carol', n)
		const first = await feed_page(db, 'bob', 'for_you', undefined)
		const second = await feed_page(db, 'bob', 'for_you', first.next)
		expect(first.posts).toHaveLength(PAGE_SIZE)
		expect(second.posts).toHaveLength(5)
		expect(second.next).toBeUndefined()
		expect(second.as_of).toBe(first.as_of)
		const seen = [...first.posts, ...second.posts].map((view) => view.id)
		expect(new Set(seen).size).toBe(PAGE_SIZE + 5)
	})
})
