import { beforeEach, describe, expect, it } from 'vitest'
import { follow } from './db/schema'
import { add_account, test_db, type TestDb } from './db/test-d1'
import { find_profile_by_handle, save_profile } from './profiles'

let db: TestDb

beforeEach(async () => {
	db = test_db()
	for (const handle of ['alice', 'bob', 'carol']) await add_account(db, handle)
	// Carol follows Alice; Bob doesn't.
	await db.insert(follow).values({ followerId: 'carol', followingId: 'alice' })
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
