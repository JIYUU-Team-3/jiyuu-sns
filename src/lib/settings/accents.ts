/*
 * Accent colours. Blue is the brand default and keeps the hand-tuned tokens in app.css; every
 * other accent is generated from one OKLCH hue by the same recipe as Daylight, which holds text
 * and white-on-fill contrast at AA in both bands (see accents.spec.ts).
 */
import { accent_tokens } from './daylight'

export const ACCENTS = ['blue', 'purple', 'pink', 'orange', 'green'] as const
type Accent = (typeof ACCENTS)[number]

const HUES: Record<Exclude<Accent, 'blue'>, number> = {
	purple: 295,
	pink: 350,
	orange: 48,
	green: 152,
}

/** The OKLCH hue for an accent, or undefined for blue, which lets Daylight drift its own. */
export const accent_hue = (accent: Accent) => (accent === 'blue' ? undefined : HUES[accent])

/** The colour that stands for an accent in the picker. */
export const accent_swatch = (accent: Accent) =>
	accent === 'blue' ? '#1d9bf0' : accent_tokens(HUES[accent], false)['--accent']

const block = (selector: string, tokens: Record<string, string>) =>
	`${selector}{${Object.entries(tokens)
		.map(([k, v]) => `${k}:${v}`)
		.join(';')}}`

/**
 * The stylesheet for a non-blue accent, or nothing for blue. Each dark block outranks the light
 * one (and app.css's own palettes) by one attribute, so source order never decides.
 */
export function accent_css(accent: Accent) {
	if (accent === 'blue') return ''
	const h = HUES[accent]
	const dark = accent_tokens(h, true)
	return [
		block(':root[data-accent]', accent_tokens(h, false)),
		`@media (prefers-color-scheme: dark){${block(":root[data-accent]:not([data-theme='light'])", dark)}}`,
		block(":root[data-accent][data-theme='dark']", dark),
	].join('')
}
