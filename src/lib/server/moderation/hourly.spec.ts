import { eq } from 'drizzle-orm'
import { describe, expect, it, vi } from 'vitest'
import { blockedDomain, moderationCase, post } from '../db/schema'
import { add_account, test_db } from '../db/test-d1'
import { run_hourly } from './hourly'
import { moderate_post, REMOVED_KEPT_MS } from './posts'

const bucket = { delete: vi.fn(async () => {}), get: async () => null } as unknown as R2Bucket

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
		expect(summary).toEqual({ purged: 1, retried: 1, hosts: 2, blocked: 1 })

		const left = await db.select({ id: post.id, checked: post.checked }).from(post)
		expect(left.map((row) => row.id).sort()).toEqual(['fine', 'link', 'retry'])
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
