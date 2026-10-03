import { describe, expect, it } from 'vitest'
import { accent_swatch } from '#lib/settings/accents'
import { DEFAULT_PREFS, daylight_vars, local_minutes } from '#lib/settings/prefs'
import { logo_colours } from './push-theme'

describe('logo_colours', () => {
	it('leaves the ground to the device under System', () => {
		expect(logo_colours(DEFAULT_PREFS)).toEqual({ mark: '#1d9bf0' })
	})

	it('uses the app’s background under Light and Dark', () => {
		expect(logo_colours({ ...DEFAULT_PREFS, theme: 'light' })).toEqual({
			ground: '#ffffff',
			mark: '#1d9bf0',
		})
		expect(logo_colours({ ...DEFAULT_PREFS, theme: 'dark' })).toEqual({
			ground: '#161618',
			mark: '#1d9bf0',
		})
	})

	it('draws the Y in the chosen accent', () => {
		const prefs = { ...DEFAULT_PREFS, theme: 'light' as const, accent: 'pink' as const }
		expect(logo_colours(prefs).mark).toBe(accent_swatch('pink'))
		const dark = logo_colours({ ...prefs, theme: 'dark' })
		expect(dark.mark).not.toBe(accent_swatch('pink'))
	})

	it('follows Daylight’s colours for the time now', () => {
		const now = new Date(2026, 9, 3, 22, 0)
		const vars = daylight_vars(local_minutes(now, now.getTimezoneOffset()), 'blue')
		expect(logo_colours({ ...DEFAULT_PREFS, theme: 'daylight' }, now)).toEqual({
			ground: vars['--bg'],
			mark: vars['--accent'],
		})
	})
})
