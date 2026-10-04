import { beforeEach, describe, expect, it, vi } from 'vitest'
import { conversation, message, moderationCase, post } from '../db/schema'
import { add_account, test_db, type TestDb } from '../db/test-d1'
import {
	decide_review,
	dismiss_case,
	on_report,
	open_cases,
	open_reviews,
	raise_case,
	reopen_review,
} from './cases'
import { request_review, suspend } from './standing'

vi.mock('./after-write', () => ({ check_posts_later: () => {} }))

let db: TestDb
beforeEach(async () => {
	db = test_db()
	await add_account(db, 'mod')
	await add_account(db, 'alice')
	await db.insert(post).values({ id: 'p1', authorId: 'alice', body: 'a reported post' })
})

const report = (reason: string) => ({
	target_kind: 'post' as const,
	target_id: 'p1',
	target_user_id: 'alice',
	reason,
})

describe('on_report', () => {
	it('opens one case per target and adds later reports to it', async () => {
		const first = await on_report(db, report('spam'))
		const second = await on_report(db, report('harassment'))
		expect(second).toBe(first)
		const [row] = await db.select().from(moderationCase)
		expect(row).toMatchObject({ reports: 2, priority: 2, status: 'open', reason: 'spam' })
	})

	it('puts a never-allowed rule far up the queue', async () => {
		await on_report(db, report('threat'))
		const [row] = await db.select().from(moderationCase)
		expect(row.priority).toBeGreaterThan(10)
	})

	it('counts a report with an unknown reason, unnamed', async () => {
		await on_report(db, report('nonsense'))
		const [row] = await db.select().from(moderationCase)
		expect(row).toMatchObject({ reports: 1, reason: null })
	})

	it('reopens a dismissed case', async () => {
		const id = await on_report(db, report('spam'))
		expect(await dismiss_case(db, 'mod', id)).toBe(true)
		expect(await dismiss_case(db, 'mod', id)).toBe(false)
		expect(await open_cases(db)).toEqual([])
		await on_report(db, report('spam'))
		expect((await open_cases(db)).map((item) => item.id)).toEqual([id])
	})
})

describe('raise_case', () => {
	it('merges automatic flags', async () => {
		const target = { kind: 'post' as const, id: 'p1', user_id: 'alice' }
		await raise_case(db, target, { weight: 1, flags: { text: { safe: false } } })
		await raise_case(db, target, { weight: 1, flags: { links: ['bad.example'] } })
		const [item] = await open_cases(db)
		expect(item.flags).toEqual({ text: { safe: false }, links: ['bad.example'] })
		expect(item.reports).toBe(0)
	})
})

describe('open_cases', () => {
	it('shows what was reported and who wrote it, highest priority first', async () => {
		await db.insert(conversation).values({ id: 'c1' })
		await db.insert(message).values({
			id: 'm1',
			conversationId: 'c1',
			senderId: 'alice',
			body: 'a reported message',
		})
		await on_report(db, report('spam'))
		await on_report(db, {
			target_kind: 'message',
			target_id: 'm1',
			target_user_id: 'alice',
			reason: 'threat',
		})
		await on_report(db, {
			target_kind: 'post',
			target_id: 'gone',
			target_user_id: 'alice',
			reason: 'spam',
		})
		const items = await open_cases(db)
		expect(items[0]).toMatchObject({ kind: 'message', text: 'a reported message', exists: true })
		expect(items.find((item) => item.target_id === 'p1')).toMatchObject({
			text: 'a reported post',
			author: { id: 'alice', handle: 'alice' },
			exists: true,
		})
		expect(items.find((item) => item.target_id === 'gone')?.exists).toBe(false)
	})
})

describe('review requests', () => {
	it('are listed until decided, once', async () => {
		const action = (await suspend(db, {
			moderator_id: 'mod',
			user_id: 'alice',
			reason: 'spam',
			days: 7,
		}))!
		await request_review(db, 'alice', action, 'It was a mistake')
		const [review] = await open_reviews(db)
		expect(review).toMatchObject({ body: 'It was a mistake', author: { handle: 'alice' } })

		expect(await decide_review(db, 'mod', review.id, true)).toMatchObject({
			action: 'suspend',
			user_id: 'alice',
		})
		expect(await decide_review(db, 'mod', review.id, false)).toBeUndefined()
		expect(await open_reviews(db)).toEqual([])
	})

	it('go back in the queue when acting on the decision failed, for the same moderator only', async () => {
		await add_account(db, 'other')
		const action = (await suspend(db, {
			moderator_id: 'mod',
			user_id: 'alice',
			reason: 'spam',
			days: 7,
		}))!
		await request_review(db, 'alice', action, 'Please')
		const [review] = await open_reviews(db)
		await decide_review(db, 'mod', review.id, true)

		await reopen_review(db, 'other', review.id)
		expect(await open_reviews(db)).toEqual([])
		await reopen_review(db, 'mod', review.id)
		expect(await open_reviews(db)).toMatchObject([{ id: review.id }])
		expect(await decide_review(db, 'mod', review.id, true)).toMatchObject({ action: 'suspend' })
	})
})
