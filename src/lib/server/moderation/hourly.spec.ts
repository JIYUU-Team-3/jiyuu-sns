import { eq } from 'drizzle-orm'
import { describe, expect, it, vi } from 'vitest'
import { blockedDomain, mediaCheck, moderationCase, post, postMedia } from '../db/schema'
import { add_account, test_db } from '../db/test-d1'
import { run_hourly } from './hourly'
import { moderate_post, REMOVED_KEPT_MS } from './posts'

const bucket = {
	delete: vi.fn(async () => {}),
	get: async () => null,
	list: async () => ({ objects: [], truncated: false }),
} as unknown as R2Bucket

/** Cloudflare's resolver, reporting `bad` as malware. */
const resolver = (bad: string) =>
	vi.fn(async (input: string | URL | Request) => {
		const name = new URL(String(input)).searchParams.get('name')
		const data = name === bad ? '0.0.0.0' : '93.184.216.34'
		return new Response(`{"Status":0,"Question":[],"Answer":[{"data":"${data}"}]}`)
	}) as unknown as typeof fetch

describe('run_hourly', () => {
	it('purges removed posts, retries unfinished checks and blocks hosts that turned bad', async () => {
		const db = test_db()
		await add_account(db, 'mod')
		await add_account(db, 'alice')
		await db.insert(post).values([
			{ id: 'gone', authorId: 'alice', body: 'removed' },
			{ id: 'retry', authorId: 'alice', body: 'not checked yet', checked: 'unchecked' },
			// Left `pending` by a check that never finished; a day later it's retried too.
			{ id: 'stuck', authorId: 'alice', body: 'never checked', checked: 'pending' },
			{ id: 'link', authorId: 'alice', body: 'read https://turned-bad.example/x' },
			{ id: 'fine', authorId: 'alice', body: 'read https://fine.example/x' },
		])
		await moderate_post(db, {
			moderator_id: 'mod',
			post_id: 'gone',
			action: 'remove',
			reason: 'spam',
		})

		const later = Date.now() + REMOVED_KEPT_MS + 60_000
		const summary = await run_hourly(
			db,
			{ bucket, enabled: false, lookup: resolver('turned-bad.example') },
			later,
		)
		expect(summary).toMatchObject({ purged: 1, retried: 2, hosts: 2, blocked: 1, restricted: 0 })

		const left = await db.select({ id: post.id, checked: post.checked }).from(post)
		expect(left.map((row) => row.id).sort((a, b) => a.localeCompare(b))).toEqual([
			'fine',
			'link',
			'retry',
			'stuck',
		])
		expect(left.find((row) => row.id === 'stuck')?.checked).toBe('skipped')
		// With Workers AI off the retry settles as skipped, so it isn't tried forever.
		expect(left.find((row) => row.id === 'retry')?.checked).toBe('skipped')
		expect(await db.select().from(blockedDomain)).toEqual([
			expect.objectContaining({ domain: 'turned-bad.example', addedBy: null }),
		])
		const [flagged] = await db
			.select()
			.from(moderationCase)
			.where(eq(moderationCase.targetId, 'link'))
		expect(flagged).toMatchObject({ reason: 'malicious_link', status: 'open' })
	})
})

describe('the upload sweep', () => {
	const HOUR = 60 * 60 * 1000
	const now = Date.now()
	const file = (key: string, hours_old: number) => ({
		key,
		uploaded: new Date(now - hours_old * HOUR),
	})

	it('deletes day-old post uploads no post uses, and carries on where it stopped', async () => {
		const db = test_db()
		await add_account(db, 'alice')
		await db.insert(post).values({ id: 'p', authorId: 'alice', body: 'with a photo' })
		await db.insert(postMedia).values({
			postId: 'p',
			position: 0,
			kind: 'image',
			url: '/media/posts/alice/used.jpg',
			width: 1,
			height: 1,
		})
		await db.insert(mediaCheck).values({ url: '/media/posts/alice/left.jpg', userId: 'alice' })

		const deleted = vi.fn(async () => {})
		const list = vi.fn(async () => ({
			objects: [
				file('posts/alice/used.jpg', 48),
				file('posts/alice/left.jpg', 48),
				// Still inside the day a draft may be open for.
				file('posts/alice/fresh.jpg', 2),
			],
			truncated: true,
			cursor: 'next-page',
		}))
		const stored = new Map<string, string>([['sweep:post-uploads', 'this-page']])
		const kv = {
			get: async (key: string) => stored.get(key) ?? null,
			put: async (key: string, value: string) => void stored.set(key, value),
			delete: async (key: string) => void stored.delete(key),
		} as unknown as KVNamespace
		const swept_bucket = { delete: deleted, get: async () => null, list } as unknown as R2Bucket

		const summary = await run_hourly(db, { bucket: swept_bucket, enabled: false, kv }, now)
		expect(summary.swept).toBe(1)
		expect(list).toHaveBeenCalledWith({ prefix: 'posts/', limit: 500, cursor: 'this-page' })
		expect(deleted).toHaveBeenCalledWith(['posts/alice/left.jpg'])
		expect(await db.select().from(mediaCheck)).toEqual([])
		expect(stored.get('sweep:post-uploads')).toBe('next-page')
	})
})
