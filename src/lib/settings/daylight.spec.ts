import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { day_seed, day_tokens, hhmm } from './daylight'

/** The mockup's own Daylight functions, to check the port paints the same colours. */
function mockup_day_tokens(): (hour: number) => { vars: Record<string, string> } {
	const html = readFileSync(
		resolve(import.meta.dirname, '../../../design/mockup/index.html'),
		'utf8',
	)
	const start = html.indexOf('const DAY_KEYS')
	const end = html.indexOf(
		'/* ============================================================\n   State',
	)
	return runInNewContext(`${html.slice(start, end)}; dayTokens`) as never
}

describe('Daylight', () => {
	it('switches between light and dark across dawn and dusk', () => {
		expect(day_seed(5.9).dark).toBe(true)
		expect(day_seed(6.1).dark).toBe(false)
		expect(day_seed(18.1).dark).toBe(false)
		expect(day_seed(18.5).dark).toBe(true)
		expect(day_seed(12.5).name).toBe('midday')
		expect(day_seed(23.9).name).toBe('twilight')
	})

	it('paints the same colours as the mockup at every quarter hour', () => {
		const mockup = mockup_day_tokens()
		for (let hour = 0; hour < 24; hour += 0.25) {
			// The app has no unread-row tint, so it's the one token the port leaves out.
			const expected = mockup(hour).vars
			delete expected['--unread']
			expect(day_tokens(hour).vars).toEqual(expected)
		}
	})

	it('uses a chosen accent hue instead of the drifting one', () => {
		const drifting = day_tokens(9).vars['--accent-fill']
		const pinned = day_tokens(9, 350).vars['--accent-fill']
		expect(pinned).not.toBe(drifting)
		expect(day_tokens(21, 350).vars['--accent-fill']).toBe(pinned)
	})

	it('formats minutes as HH:MM', () => {
		expect(hhmm(0)).toBe('00:00')
		expect(hhmm(545)).toBe('09:05')
		expect(hhmm(1439)).toBe('23:59')
	})
})
