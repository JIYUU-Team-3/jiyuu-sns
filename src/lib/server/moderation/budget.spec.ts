import { describe, expect, it } from 'vitest'
import { aiUsage } from '../db/schema'
import { test_db } from '../db/test-d1'
import { DAILY_NEURONS, exhaust, reserve, settle, today } from './budget'

const now = Date.UTC(2026, 9, 1, 12)

describe('budget', () => {
	it('reserves until the day’s cap, and starts again the next day', async () => {
		const db = test_db()
		expect(await reserve(db, 'text', DAILY_NEURONS.text - 10, false, now)).toBe(true)
		expect(await reserve(db, 'text', 10, false, now)).toBe(true)
		expect(await reserve(db, 'text', 1, false, now)).toBe(false)
		// Each kind has its own budget.
		expect(await reserve(db, 'image', 10, false, now)).toBe(true)
		expect(await reserve(db, 'text', 1, false, now + 24 * 60 * 60 * 1000)).toBe(true)
	})

	it('lets new accounts use only the first half', async () => {
		const db = test_db()
		expect(await reserve(db, 'image', DAILY_NEURONS.image / 2, true, now)).toBe(true)
		expect(await reserve(db, 'image', 1, true, now)).toBe(false)
		expect(await reserve(db, 'image', 1, false, now)).toBe(true)
	})

	it('settles to the real cost, and stops for the day once Workers AI says it’s spent', async () => {
		const db = test_db()
		await reserve(db, 'text', 30, false, now)
		await settle(db, 'text', 30, 18, now)
		expect((await db.select().from(aiUsage))[0]).toMatchObject({ day: today(now), text: 18 })
		await exhaust(db, now)
		expect(await reserve(db, 'report', 1, false, now)).toBe(false)
	})
})
