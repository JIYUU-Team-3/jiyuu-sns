import { beforeEach, describe, expect, it } from 'vitest'
import { accountStanding, follow, moderationCase, post } from '../db/schema'
import { add_account, test_db, type TestDb } from '../db/test-d1'
import {
	near_duplicate_share,
	run_scores,
	score_of,
	SCORE_THRESHOLD,
	set_restricted,
	signals,
} from './score'
import { trust_level } from './trust'

const calm = {
	posts_last_hour: 1,
	near_duplicates: 0,
	links_per_post: 0,
	follows_last_hour: 2,
	cold_chats: 0,
	reports: 0,
	actions: 0,
}

describe('score_of', () => {
	it('leaves an ordinary hour well under the threshold', () => {
		expect(score_of(calm)).toBeLessThan(10)
	})

	it('needs more than one habit to cross it', () => {
		expect(score_of({ ...calm, posts_last_hour: 100 })).toBeLessThan(SCORE_THRESHOLD)
		expect(score_of({ ...calm, follows_last_hour: 500 })).toBeLessThan(SCORE_THRESHOLD)
		expect(
			score_of({ ...calm, posts_last_hour: 15, near_duplicates: 1, links_per_post: 2 }),
		).toBeGreaterThanOrEqual(SCORE_THRESHOLD)
	})
})

describe('near_duplicate_share', () => {
	it('sees through changed numbers, punctuation and links', () => {
		expect(
			near_duplicate_share([
				'Win 500 coins now!! https://a.example/1',
				'win 20 coins now https://b.example/2',
				'WIN 9 COINS NOW https://c.example',
				'Something else entirely today',
			]),
		).toBe(0.75)
		expect(near_duplicate_share(['short', 'short', 'short'])).toBe(0)
		expect(near_duplicate_share(['one post about lunch', 'one post about lunch'])).toBe(0)
	})
})

let db: TestDb
const now = Date.now()

beforeEach(async () => {
	db = test_db()
	for (const handle of ['spammer', 'calm', 'mod', 'x1', 'x2']) await add_account(db, handle)
	await db.insert(accountStanding).values({ userId: 'mod', role: 'moderator' })
})

async function burst(author: string, count: number) {
	for (let i = 0; i < count; i++) {
		await db.insert(post).values({
			id: `${author}-${i}`,
			authorId: author,
			body: `Free followers ${i} at https://cheap${i}.example/x https://more.example/${i}`,
			createdAt: new Date(now - 60_000),
		})
	}
}

describe('signals', () => {
	it('reads an account’s last hour and day', async () => {
		await burst('spammer', 4)
		await db.insert(follow).values([
			{ followerId: 'spammer', followingId: 'x1' },
			{ followerId: 'spammer', followingId: 'x2' },
		])
		expect(await signals(db, 'spammer', now)).toMatchObject({
			posts_last_hour: 4,
			near_duplicates: 1,
			links_per_post: 2,
			follows_last_hour: 2,
			cold_chats: 0,
		})
	})
})

describe('run_scores', () => {
	it('restricts a spamming account once, opens a case, and leaves others alone', async () => {
		await burst('spammer', 15)
		await burst('mod', 15)
		await db.insert(post).values({ id: 'c', authorId: 'calm', body: 'A quiet post about lunch' })

		expect(await run_scores(db, now)).toEqual({ scored: 3, restricted: 1 })
		expect(await trust_level(db, 'spammer')).toBe('restricted')
		expect(await trust_level(db, 'calm')).toBe('new')
		const [item] = await db.select().from(moderationCase)
		expect(item).toMatchObject({ targetKind: 'profile', targetId: 'spammer', reason: 'spam' })

		// Already restricted: scored again, not restricted twice.
		expect(await run_scores(db, now)).toEqual({ scored: 3, restricted: 0 })
	})

	it('lets a moderator lift or impose a restriction', async () => {
		await burst('spammer', 15)
		await run_scores(db, now)
		await set_restricted(db, 'mod', 'spammer', false)
		expect(await trust_level(db, 'spammer')).not.toBe('restricted')
		await set_restricted(db, 'mod', 'calm', true)
		expect(await trust_level(db, 'calm')).toBe('restricted')
	})
})

describe('run_scores with many accounts', () => {
	it('stays inside D1’s 100-parameter limit', async () => {
		for (let i = 0; i < 120; i++) {
			await add_account(db, `busy${i}`)
			await db.insert(post).values({ id: `busy${i}`, authorId: `busy${i}`, body: 'hello there' })
		}
		expect((await run_scores(db, now)).scored).toBe(120)
	})
})

describe('which accounts are scored', () => {
	it('takes the most recently active when there are more than one run scores', async () => {
		for (let i = 0; i < 205; i++) {
			await add_account(db, `idle${i}`)
			await db.insert(post).values({
				id: `idle${i}`,
				authorId: `idle${i}`,
				body: 'hello there',
				createdAt: new Date(now - 90 * 60_000),
			})
		}
		await burst('spammer', 15)
		expect(await run_scores(db, now)).toEqual({ scored: 200, restricted: 1 })
	})
})
