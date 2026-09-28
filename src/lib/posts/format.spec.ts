import { describe, expect, it } from 'vitest'
import { format_age, format_count, format_short_date, format_timestamp } from './format'

const UTC = { time_zone: 'UTC' }
const now = Date.UTC(2026, 8, 25, 12, 0)
const MINUTE = 60_000

describe('format_age', () => {
	it('uses X’s compact steps', () => {
		expect(format_age(now - 10_000, now, 'en', UTC)).toBe('now')
		expect(format_age(now - 5 * MINUTE, now, 'en', UTC)).toBe('5m')
		expect(format_age(now - 3 * 60 * MINUTE, now, 'en', UTC)).toBe('3h')
		expect(format_age(now - 3 * 24 * 60 * MINUTE, now, 'en', UTC)).toBe('Sep 22')
	})

	it('localizes the units', () => {
		expect(format_age(now - 5 * MINUTE, now, 'ja', UTC)).toBe('5分')
		expect(format_age(now - 5 * MINUTE, now, 'km', UTC)).toBe('5នាទី')
	})

	it('treats a clock slightly ahead of the server as now', () => {
		expect(format_age(now + 5_000, now, 'en', UTC)).toBe('now')
	})
})

describe('format_short_date', () => {
	it('adds the year only for another year', () => {
		expect(format_short_date(Date.UTC(2026, 0, 2), now, 'en', UTC)).toBe('Jan 2')
		expect(format_short_date(Date.UTC(2025, 0, 2), now, 'en', UTC)).toBe('Jan 2, 2025')
	})

	it('builds Khmer dates by hand', () => {
		expect(format_short_date(Date.UTC(2026, 8, 1), now, 'km', UTC)).toBe('1 កញ្ញា')
		expect(format_short_date(Date.UTC(2025, 8, 1), now, 'km', UTC)).toBe('1 កញ្ញា 2025')
	})
})

describe('format_timestamp', () => {
	it('joins the clock and the date', () => {
		expect(format_timestamp(Date.UTC(2026, 8, 25, 10, 25), 'en', UTC)).toBe(
			'10:25 AM · Sep 25, 2026',
		)
		expect(format_timestamp(Date.UTC(2026, 8, 25, 10, 5), 'km', UTC)).toBe('10:05 · 25 កញ្ញា 2026')
	})
})

describe('format_count', () => {
	it('compacts like X', () => {
		expect(format_count(999, 'en')).toBe('999')
		expect(format_count(1234, 'en')).toBe('1.2K')
		expect(format_count(12_345, 'en')).toBe('12K')
		expect(format_count(1_250_000, 'en')).toBe('1.3M')
	})
})
