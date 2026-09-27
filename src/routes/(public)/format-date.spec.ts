import { describe, expect, it } from 'vitest'
import { format_long_date } from './format-date'

describe('format_long_date', () => {
	const time = Date.UTC(2026, 8, 26)

	it('formats Khmer by hand with CLDR month names', () => {
		expect(format_long_date(time, 'km')).toBe('26 កញ្ញា 2026')
	})

	it('matches full ICU output for every Khmer month', () => {
		const icu = new Intl.DateTimeFormat('km', { dateStyle: 'long', timeZone: 'UTC' })
		for (let month = 0; month < 12; month++) {
			const t = Date.UTC(2026, month, 1)
			expect(format_long_date(t, 'km')).toBe(icu.format(t))
		}
	})

	it('uses Intl for other locales', () => {
		expect(format_long_date(time, 'en')).toBe('September 26, 2026')
		expect(format_long_date(time, 'ja')).toBe('2026年9月26日')
	})

	it('reads the date in UTC', () => {
		expect(format_long_date(Date.UTC(2026, 0, 1, 23, 30), 'km')).toBe('1 មករា 2026')
	})
})
