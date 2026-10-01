import { describe, expect, it } from 'vitest'
import { ACCENTS, accent_css } from './accents'
import { contrast } from './color'
import { accent_tokens, day_tokens } from './daylight'

// The fixed grounds from app.css: page and hover wash, light and dark.
const GROUNDS = { light: ['#ffffff', '#f7f8f9'], dark: ['#161618', '#1d1d20'] }
const HUES = { purple: 295, pink: 350, orange: 48, green: 152 }

describe('accent palettes', () => {
	it.each(Object.entries(HUES))('%s keeps text, fill and stroke contrast', (_, hue) => {
		for (const dark of [false, true]) {
			const t = accent_tokens(hue, dark)
			for (const ground of GROUNDS[dark ? 'dark' : 'light']) {
				expect(contrast(t['--accent-text'], ground)).toBeGreaterThanOrEqual(4.5)
				expect(contrast(t['--accent'], ground)).toBeGreaterThanOrEqual(3)
			}
			expect(contrast('#ffffff', t['--accent-fill'])).toBeGreaterThanOrEqual(4.5)
		}
	})

	it('keeps accent text readable on Daylight at every hour', () => {
		for (const hue of [undefined, ...Object.values(HUES)]) {
			for (let hour = 0; hour < 24; hour += 0.5) {
				const { vars } = day_tokens(hour, hue)
				expect(contrast(vars['--accent-text'], vars['--bg'])).toBeGreaterThanOrEqual(4.5)
				expect(contrast('#ffffff', vars['--accent-fill'])).toBeGreaterThanOrEqual(4.5)
			}
		}
	})

	it('emits no stylesheet for blue, which app.css already holds', () => {
		expect(accent_css('blue')).toBe('')
	})

	it('outranks the light block with each dark block', () => {
		for (const accent of ACCENTS.filter((a) => a !== 'blue')) {
			const css = accent_css(accent)
			expect(css).toContain(":root[data-accent]:not([data-theme='light'])")
			expect(css).toContain(":root[data-accent][data-theme='dark']")
		}
	})
})
