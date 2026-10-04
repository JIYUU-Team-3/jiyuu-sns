import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { block, follow, mutedTerm, post, postTag, profile } from './db/schema'
import { add_account, test_db, type TestDb } from './db/test-d1'
import { search_people, search_posts, trending_tags, who_to_follow } from './search'

let db: TestDb

const add_post = (id: string, author: string, location: string | null, body = `post ${id}`) =>
	db.insert(post).values({ id, authorId: author, body, location })
const live_in = (handle: string, location: string) =>
	db.update(profile).set({ location }).where(eq(profile.userId, handle))
const found_posts = async (viewer: string, q: string) =>
	(await search_posts(db, viewer, q, 'latest', undefined)).posts.map((p) => p.id).sort()
const found_people = async (viewer: string, q: string) =>
	(await search_people(db, viewer, q)).map((p) => p.handle).sort()

beforeEach(async () => {
	db = test_db()
	for (const handle of ['alice', 'bob', 'carol', 'dave']) await add_account(db, handle)
})

describe('searching for a place', () => {
	it('finds posts by their place, whichever way round the names are', async () => {
		await add_post('p1', 'alice', 'Phnom Penh, Cambodia')
		await add_post('p2', 'alice', 'Phnom Penh Municipality')
		await add_post('p3', 'alice', 'Tokyo, Japan')
		await add_post('p4', 'alice', null, 'Lunch in Phnom Penh today')
		expect(await found_posts('bob', 'Phnom Penh')).toEqual(['p1', 'p2', 'p4'])
		expect(await found_posts('bob', 'Phnom Penh Municipality')).toEqual(['p1', 'p2'])
		expect(await found_posts('bob', 'Phnom Penh, Cambodia')).toEqual(['p1', 'p2'])
	})

	it('finds people by their location, after name matches, with it in the result', async () => {
		await live_in('alice', 'Phnom Penh Municipality')
		await live_in('carol', 'Tokyo')
		const people = await search_people(db, 'bob', 'Phnom Penh')
		expect(people.map((p) => p.handle)).toEqual(['alice'])
		expect(people[0].location).toBe('Phnom Penh Municipality')
	})

	it('needs a few letters before matching places', async () => {
		await live_in('alice', 'Osaka')
		await add_post('p1', 'carol', 'Osaka', 'Hello there')
		expect(await found_people('bob', 'Os')).toEqual([])
		expect(await found_posts('bob', 'Os')).toEqual([])
		// A stored place too short to mean anything doesn't match every query containing it.
		await live_in('dave', 'NY')
		expect(await found_people('bob', 'Sunny Bay')).toEqual([])
	})

	it('keeps blocks and private accounts out of place results', async () => {
		await live_in('alice', 'Tokyo')
		await live_in('carol', 'Tokyo')
		await add_post('a1', 'alice', 'Tokyo')
		await add_post('c1', 'carol', 'Tokyo')
		await db.insert(block).values({ blockerId: 'alice', blockedId: 'bob' })
		await db.update(profile).set({ isPrivate: true }).where(eq(profile.userId, 'carol'))
		expect(await found_people('bob', 'Tokyo')).toEqual(['carol'])
		expect(await found_posts('bob', 'Tokyo')).toEqual([])
		await db.insert(follow).values({ followerId: 'dave', followingId: 'carol' })
		expect(await found_posts('dave', 'Tokyo')).toEqual(['a1', 'c1'])
	})
})

describe('the sidebar', () => {
	const tag_post = async (id: string, tags: string[]) => {
		await add_post(id, 'alice', null, tags.map((tag) => `#${tag}`).join(' '))
		const createdAt = new Date()
		for (const tag of tags) await db.insert(postTag).values({ postId: id, tag, createdAt })
	}

	it('lists the week’s tags by use, leaving out the ones the viewer muted', async () => {
		await tag_post('t1', ['cats', 'dogs'])
		await tag_post('t2', ['cats'])
		await tag_post('t3', ['cats', 'birds'])
		await tag_post('t4', ['dogs'])
		const tags = async (viewer: string) => (await trending_tags(db, 5, viewer)).map((t) => t.tag)
		expect(await tags('bob')).toEqual(['cats', 'dogs', 'birds'])
		await db.insert(mutedTerm).values({ userId: 'bob', term: '#cats' })
		expect(await tags('bob')).toEqual(['dogs', 'birds'])
		expect(await tags('carol')).toEqual(['cats', 'dogs', 'birds'])
	})

	it('suggests the most followed accounts the viewer doesn’t follow, never a blocker', async () => {
		await db.insert(follow).values([
			{ followerId: 'bob', followingId: 'carol' },
			{ followerId: 'dave', followingId: 'carol' },
			{ followerId: 'bob', followingId: 'dave' },
		])
		const handles = async (viewer: string) =>
			(await who_to_follow(db, viewer, 5)).map((user) => user.handle)
		expect(await handles('alice')).toEqual(['carol', 'dave', 'bob'])
		// Bob already follows both, and doesn't see himself.
		expect(await handles('bob')).toEqual(['alice'])
		await db.insert(block).values({ blockerId: 'carol', blockedId: 'alice' })
		expect(await handles('alice')).toEqual(['dave', 'bob'])
	})

	it('still fills the list from many accounts, within D1’s parameter limit', async () => {
		for (let n = 0; n < 80; n++) await add_account(db, `user${n}`)
		await db.insert(follow).values({ followerId: 'bob', followingId: 'user5' })
		const users = await who_to_follow(db, 'alice', 20)
		expect(users).toHaveLength(20)
		expect(users[0].handle).toBe('user5')
	})
})
