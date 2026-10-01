import { describe, expect, it } from 'vitest'
import {
	DEFAULT_PREFS,
	local_minutes,
	parse_prefs,
	parse_tz,
	root_attributes,
	serialize_prefs,
} from './prefs'

describe('display preferences', () => {
	it('falls back to the defaults without a cookie', () => {
		expect(parse_prefs(undefined)).toEqual(DEFAULT_PREFS)
		expect(parse_prefs('')).toEqual(DEFAULT_PREFS)
	})

	it('round-trips through the cookie, storing only what differs', () => {
		const prefs = { ...DEFAULT_PREFS, theme: 'dark' as const, clear: true, autoplay: false }
		const cookie = serialize_prefs(prefs)
		expect(cookie).toBe('theme=dark&clear=1&autoplay=0')
		expect(parse_prefs(cookie)).toEqual(prefs)
		expect(serialize_prefs(DEFAULT_PREFS)).toBe('')
	})

	it('drops unknown values and keys, keeping the valid ones', () => {
		const prefs = parse_prefs('theme=neon&accent=pink&clear=yes&evil=1')
		expect(prefs).toEqual({ ...DEFAULT_PREFS, accent: 'pink' })
	})

	it('never copies cookie text into the root attributes', () => {
		const attrs = root_attributes(parse_prefs('theme="><script>alert(1)</script>'), 600)
		expect(attrs).toBe('')
	})

	it('writes the chosen options onto the root element', () => {
		const attrs = root_attributes(
			{ ...DEFAULT_PREFS, theme: 'dark', accent: 'green', clear: true, reduce_motion: true },
			600,
		)
		expect(attrs).toBe('data-theme="dark" data-accent="green" data-clear data-motion="reduce"')
	})

	it('paints Daylight inline, dark at night and light at noon', () => {
		const night = root_attributes({ ...DEFAULT_PREFS, theme: 'daylight' }, 0)
		const noon = root_attributes({ ...DEFAULT_PREFS, theme: 'daylight' }, 12 * 60)
		expect(night).toMatch(/^data-theme="daylight" style="--bg: rgb\(.+color-scheme: dark"$/)
		expect(noon).toContain('color-scheme: light')
	})

	it('turns a UTC time and an offset into local minutes', () => {
		const now = new Date('2026-10-01T23:30:00Z')
		expect(local_minutes(now, 0)).toBe(23 * 60 + 30)
		// Tokyo is UTC+9, which getTimezoneOffset gives as -540.
		expect(local_minutes(now, -540)).toBe(8 * 60 + 30)
		expect(local_minutes(now, 300)).toBe(18 * 60 + 30)
	})

	it('ignores a nonsense offset', () => {
		expect(parse_tz('-540')).toBe(-540)
		expect(parse_tz('abc')).toBe(0)
		expect(parse_tz('99999')).toBe(0)
		expect(parse_tz('1.5')).toBe(0)
	})
})
