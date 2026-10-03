import { describe, expect, it } from 'vitest'
import { birthday_problem, date_parts, is_birthday, join_date, shown_birthday } from './details'

describe('birthday dates', () => {
	it('accepts only real dates', () => {
		expect(date_parts('2000-02-29')).toEqual({ year: 2000, month: 2, day: 29 })
		expect(date_parts('2001-02-29')).toBeUndefined()
		expect(date_parts('2000-13-01')).toBeUndefined()
		expect(date_parts('2000-1-1')).toBeUndefined()
	})

	it('joins the three picks, or nothing until all are picked', () => {
		expect(join_date('2000', '3', '5')).toBe('2000-03-05')
		expect(join_date('2000', '', '5')).toBeUndefined()
	})

	it('refuses future dates, impossible ones and anyone under 13', () => {
		const today = new Date(Date.UTC(2026, 9, 3))
		expect(birthday_problem('2000-03-05', today)).toBeUndefined()
		expect(birthday_problem('2013-10-03', today)).toBeUndefined()
		expect(birthday_problem('2013-10-04', today)).toBe('too_young')
		expect(birthday_problem('2027-01-01', today)).toBe('invalid')
		expect(birthday_problem('1850-01-01', today)).toBe('invalid')
		expect(birthday_problem('2001-02-29', today)).toBe('invalid')
	})
})

describe('shown_birthday', () => {
	const date = '2000-03-05'
	const stranger = { mine: false, follower: false }
	const follower = { mine: false, follower: true }

	it('shows each part only to its audience', () => {
		const audiences = { day: 'followers', year: 'only_me' } as const
		expect(shown_birthday(date, audiences, stranger)).toBeUndefined()
		expect(shown_birthday(date, audiences, follower)).toEqual({ month: 3, day: 5 })
		expect(shown_birthday(date, audiences, { mine: true, follower: false })).toEqual({
			month: 3,
			day: 5,
			year: 2000,
		})
	})

	it('never shows a year without the day', () => {
		expect(shown_birthday(date, { day: 'only_me', year: 'everyone' }, stranger)).toBeUndefined()
	})

	it('knows the day in the viewer’s calendar', () => {
		expect(is_birthday({ month: 3, day: 5 }, new Date(2026, 2, 5))).toBe(true)
		expect(is_birthday({ month: 3, day: 5 }, new Date(2026, 2, 6))).toBe(false)
	})
})
