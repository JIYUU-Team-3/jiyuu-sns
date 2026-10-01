import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { accountStanding, follow, moderationAction, post, user } from '../db/schema'
import { add_account, test_db, type TestDb } from '../db/test-d1'
import { follows, follows_last_hour, posts_last_hour, repeats_own_post, trust_level } from './trust'

const DAY = 24 * 60 * 60 * 1000
const now = Date.now()
let db: TestDb

async function aged(handle: string, days: number, posts: number) {
	await add_account(db, handle)
	await db
		.update(user)
		.set({ createdAt: new Date(now - days * DAY) })
		.where(eq(user.id, handle))
	for (let i = 0; i < posts; i++) {
		await db.insert(post).values({
			id: `${handle}-${i}`,
			authorId: handle,
			body: `post ${i}`,
			createdAt: new Date(now - days * DAY),
		})
	}
}

beforeEach(() => {
	db = test_db()
})

describe('trust_level', () => {
	it('is new for the first days, and until a few posts', async () => {
		await aged('fresh', 1, 10)
		await aged('quiet', 10, 2)
		expect(await trust_level(db, 'fresh')).toBe('new')
		expect(await trust_level(db, 'quiet')).toBe('new')
	})

	it('is normal, then trusted after a clean month and twenty posts', async () => {
		await aged('regular', 10, 5)
		await aged('veteran', 40, 25)
		expect(await trust_level(db, 'regular')).toBe('normal')
		expect(await trust_level(db, 'veteran')).toBe('trusted')
		await db.insert(moderationAction).values({
			action: 'remove',
			targetKind: 'post',
			targetId: 'veteran-0',
			targetUserId: 'veteran',
		})
		expect(await trust_level(db, 'veteran')).toBe('normal')
	})

	it('is restricted whenever a moderator or the score says so', async () => {
		await aged('veteran', 40, 25)
		await db.insert(accountStanding).values({ userId: 'veteran', restricted: true })
		expect(await trust_level(db, 'veteran')).toBe('restricted')
	})
})

describe('pace and repeats', () => {
	it('counts the last hour only', async () => {
		await aged('a', 1, 0)
		await aged('b', 1, 0)
		await db.insert(post).values([
			{ id: 'old', authorId: 'a', body: 'old', createdAt: new Date(now - 2 * 60 * 60 * 1000) },
			{ id: 'new', authorId: 'a', body: 'new', createdAt: new Date(now - 60 * 1000) },
		])
		await db.insert(follow).values({ followerId: 'a', followingId: 'b' })
		expect(await posts_last_hour(db, 'a')).toBe(1)
		expect(await follows_last_hour(db, 'a')).toBe(1)
		expect(await follows(db, 'a', 'b')).toBe(true)
		expect(await follows(db, 'b', 'a')).toBe(false)
	})

	it('finds a repeat of a long post from the last day, not a short one', async () => {
		await aged('a', 1, 0)
		await db.insert(post).values([
			{
				id: 'p1',
				authorId: 'a',
				body: 'Buy cheap followers now',
				createdAt: new Date(now - 60_000),
			},
			{ id: 'p2', authorId: 'a', body: 'lol', createdAt: new Date(now - 60_000) },
			{ id: 'p3', authorId: 'a', body: 'An old announcement', createdAt: new Date(now - 2 * DAY) },
		])
		expect(await repeats_own_post(db, 'a', ['Buy cheap followers now'])).toBe(true)
		expect(await repeats_own_post(db, 'a', ['lol'])).toBe(false)
		expect(await repeats_own_post(db, 'a', ['An old announcement'])).toBe(false)
		expect(await repeats_own_post(db, 'other', ['Buy cheap followers now'])).toBe(false)
	})
})
