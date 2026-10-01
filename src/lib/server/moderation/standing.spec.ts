import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { accountStanding, moderationAction } from '../db/schema'
import { add_account, test_db, type TestDb } from '../db/test-d1'
import {
	active_suspension,
	find_standing,
	find_suspension_details,
	lift_suspension,
	request_review,
	strike_counts,
	suspend,
} from './standing'

let db: TestDb
beforeEach(async () => {
	db = test_db()
	await add_account(db, 'mod')
	await add_account(db, 'alice')
	await add_account(db, 'bob')
	await db.insert(accountStanding).values({ userId: 'mod', role: 'moderator' })
})

describe('find_standing', () => {
	it('treats an account without a row as a member in good standing', async () => {
		expect(await find_standing(db, 'alice')).toEqual({ role: 'member', suspension: undefined })
		expect((await find_standing(db, 'mod')).role).toBe('moderator')
	})

	it('reports a suspension only while it lasts', () => {
		const row = {
			suspendedAt: new Date(1000),
			suspendedUntil: new Date(5000),
			suspendReason: 'spam',
			suspendActionId: 'a',
		}
		expect(active_suspension(row, 4999)).toEqual({ until: 5000, reason: 'spam', action_id: 'a' })
		expect(active_suspension(row, 5000)).toBeUndefined()
		expect(active_suspension({ ...row, suspendedUntil: null }, 1e15)?.until).toBeNull()
		expect(active_suspension({ ...row, suspendedAt: null })).toBeUndefined()
	})
})

describe('suspend', () => {
	it('suspends, records the action, and can be lifted', async () => {
		const action = await suspend(db, {
			moderator_id: 'mod',
			user_id: 'alice',
			reason: 'harassment',
			days: 7,
			note: 'Stop',
		})
		expect(action).toBeTypeOf('string')
		const standing = await find_standing(db, 'alice')
		expect(standing.suspension?.reason).toBe('harassment')
		expect(standing.suspension?.action_id).toBe(action)
		expect(standing.suspension?.until).toBeGreaterThan(Date.now() + 6.9 * 86_400_000)

		await lift_suspension(db, 'mod', 'alice')
		expect((await find_standing(db, 'alice')).suspension).toBeUndefined()
		const actions = await db
			.select()
			.from(moderationAction)
			.where(eq(moderationAction.targetUserId, 'alice'))
		expect(actions.map((row) => row.action).sort()).toEqual(['suspend', 'unsuspend'])
		expect(actions.find((row) => row.action === 'suspend')?.reversedAt).not.toBeNull()
	})

	it('suspends for good with no end date', async () => {
		await suspend(db, { moderator_id: 'mod', user_id: 'bob', reason: 'threat', days: null })
		expect((await find_standing(db, 'bob')).suspension?.until).toBeNull()
	})

	it('cannot suspend a moderator, and leaves no action behind', async () => {
		const action = await suspend(db, {
			moderator_id: 'mod',
			user_id: 'mod',
			reason: 'spam',
			days: 1,
		})
		expect(action).toBeUndefined()
		expect((await find_standing(db, 'mod')).suspension).toBeUndefined()
		expect(await db.select().from(moderationAction)).toEqual([])
	})
})

describe('strike_counts', () => {
	it('counts live strikes inside the window and in all', async () => {
		const old = new Date(Date.now() - 100 * 86_400_000)
		await db.insert(moderationAction).values([
			{ action: 'remove', strike: true, targetKind: 'post', targetId: '1', targetUserId: 'alice' },
			{
				action: 'remove',
				strike: true,
				targetKind: 'post',
				targetId: '2',
				targetUserId: 'alice',
				createdAt: old,
			},
			{
				action: 'remove',
				strike: true,
				targetKind: 'post',
				targetId: '3',
				targetUserId: 'alice',
				reversedAt: new Date(),
			},
			{ action: 'remove', strike: false, targetKind: 'post', targetId: '4', targetUserId: 'alice' },
			{ action: 'remove', strike: true, targetKind: 'post', targetId: '5', targetUserId: 'bob' },
		])
		expect(await strike_counts(db, 'alice')).toEqual({ recent: 1, total: 2 })
	})
})

describe('request_review', () => {
	it('files one request per suspension, only for the suspended account', async () => {
		const action = (await suspend(db, {
			moderator_id: 'mod',
			user_id: 'alice',
			reason: 'spam',
			days: 1,
			note: 'Too many links',
		}))!
		expect(await request_review(db, 'bob', action, 'Not mine')).toBe(false)
		expect(await request_review(db, 'alice', action, 'Please')).toBe(true)
		expect(await request_review(db, 'alice', action, 'Again')).toBe(false)
		expect(await find_suspension_details(db, 'alice', action)).toEqual({
			note: 'Too many links',
			review: 'open',
		})
		// Someone else's suspension tells nothing.
		expect(await find_suspension_details(db, 'bob', action)).toEqual({
			note: undefined,
			review: undefined,
		})
	})
})
