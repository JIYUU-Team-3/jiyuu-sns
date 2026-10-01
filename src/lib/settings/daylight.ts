/*
 * The Daylight theme from the mockup: a palette that follows the time of day.
 * Keyframes are "seeds" (surface lightness, hue and chroma, plus an accent hue) at clock hours.
 * Hue, chroma and accent drift continuously; surface lightness stays in a light or a dark band so
 * text never passes through an unreadable mid-grey. Band flips cross-fade through the @property
 * transitions in app.css.
 */
import { col } from './color'

type Seed = {
	name: DayName
	dark: boolean
	lightness: number
	hue: number
	chroma: number
	accent_hue: number
}

const DAY_KEYS = [
	{ h: 0, name: 'midnight', dark: true, lightness: 0.15, hue: 262, chroma: 0.02, accent_hue: 258 },
	{
		h: 4.5,
		name: 'small_hours',
		dark: true,
		lightness: 0.18,
		hue: 282,
		chroma: 0.028,
		accent_hue: 272,
	},
	{
		h: 5.75,
		name: 'first_light',
		dark: true,
		lightness: 0.205,
		hue: 305,
		chroma: 0.032,
		accent_hue: 290,
	},
	{ h: 6.25, name: 'dawn', dark: false, lightness: 0.95, hue: 35, chroma: 0.026, accent_hue: 282 },
	{
		h: 8.5,
		name: 'morning',
		dark: false,
		lightness: 0.975,
		hue: 215,
		chroma: 0.012,
		accent_hue: 252,
	},
	{
		h: 12.5,
		name: 'midday',
		dark: false,
		lightness: 0.99,
		hue: 235,
		chroma: 0.004,
		accent_hue: 255,
	},
	{
		h: 16.5,
		name: 'afternoon',
		dark: false,
		lightness: 0.975,
		hue: 85,
		chroma: 0.016,
		accent_hue: 257,
	},
	{
		h: 18,
		name: 'golden_hour',
		dark: false,
		lightness: 0.952,
		hue: 65,
		chroma: 0.034,
		accent_hue: 262,
	},
	{ h: 18.6, name: 'dusk', dark: true, lightness: 0.215, hue: 335, chroma: 0.034, accent_hue: 300 },
	{
		h: 20.5,
		name: 'twilight',
		dark: true,
		lightness: 0.175,
		hue: 285,
		chroma: 0.026,
		accent_hue: 268,
	},
] as const

export type DayName = (typeof DAY_KEYS)[number]['name']

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

function lerp_hue(a: number, b: number, t: number) {
	const d = ((b - a + 540) % 360) - 180
	return (a + d * t + 360) % 360
}

/**
 * The palette seed for a time in fractional hours from midnight (0 <= hour < 24).
 * The last keyframe wraps into midnight; lightness switches midway across a light/dark change.
 * The name belongs to the keyframe before the time.
 */
export function day_seed(hour: number): Seed {
	const n = DAY_KEYS.length
	let i = n - 1
	while (i > 0 && DAY_KEYS[i].h > hour) i--
	const a = DAY_KEYS[i]
	const b = DAY_KEYS[(i + 1) % n]
	const span = (b.h - a.h + 24) % 24 || 24
	const t = ((hour - a.h + 24) % 24) / span
	const e = t * t * (3 - 2 * t)
	// Across a band change, lightness snaps at the midpoint; everything else keeps drifting.
	const near = e < 0.5 ? a : b
	const same_band = a.dark === b.dark
	return {
		name: a.name,
		dark: same_band ? a.dark : near.dark,
		lightness: same_band ? lerp(a.lightness, b.lightness, e) : near.lightness,
		hue: lerp_hue(a.hue, b.hue, e),
		chroma: lerp(a.chroma, b.chroma, e),
		accent_hue: lerp_hue(a.accent_hue, b.accent_hue, e),
	}
}

function surface_tokens(s: Seed) {
	const d = s.dark ? 1 : -1
	const sf = (dl: number, cm = 1) =>
		col(Math.min(0.998, s.lightness + d * dl), s.chroma * cm, s.hue)
	return {
		'--bg': sf(0),
		'--bg-2': sf(0.022),
		'--bg-3': sf(0.045),
		'--bg-elev': s.dark ? sf(0.03) : sf(-0.02),
		'--line': sf(s.dark ? 0.075 : 0.065, 1.2),
		'--line-2': sf(s.dark ? 0.15 : 0.14, 1.1),
		'--img-fallback': sf(0.07),
	}
}

function ink_tokens(s: Seed) {
	const c = Math.min(0.03, s.chroma * 0.8 + 0.006)
	return s.dark
		? {
				'--text': col(0.945, c * 0.5, s.hue),
				'--text-2': col(0.765, c, s.hue),
				'--text-3': col(0.735, c, s.hue),
			}
		: {
				'--text': col(0.215, c, s.hue),
				'--text-2': col(0.455, c, s.hue),
				'--text-3': col(0.475, c, s.hue),
			}
}

/** The accent family for a hue, on a light or a dark ground. Shared with the accent palettes. */
export function accent_tokens(h: number, dark: boolean) {
	return {
		'--accent': col(dark ? 0.7 : 0.63, 0.15, h),
		'--accent-text': col(dark ? 0.78 : 0.5, dark ? 0.12 : 0.16, h),
		'--accent-fill': col(0.5, 0.16, h),
		'--accent-fill-hover': col(dark ? 0.55 : 0.45, 0.16, h),
		'--accent-soft': col(0.63, 0.15, h, dark ? 0.16 : 0.1),
		'--accent-soft-2': col(0.63, 0.15, h, dark ? 0.26 : 0.18),
	}
}

function signal_tokens(s: Seed) {
	const k = s.dark
	return {
		'--like': col(k ? 0.72 : 0.54, 0.2, 0),
		'--like-soft': col(0.62, 0.2, 0, k ? 0.16 : 0.1),
		'--repost': col(k ? 0.76 : 0.51, 0.14, 160),
		'--repost-soft': col(0.62, 0.14, 160, k ? 0.16 : 0.12),
		'--danger': col(k ? 0.7 : 0.55, 0.19, 27),
		'--danger-soft': col(0.6, 0.19, 27, k ? 0.14 : 0.08),
		'--danger-fill': col(0.52, 0.19, 27),
	}
}

function depth_tokens(s: Seed) {
	const shade = (alpha: number) => col(s.dark ? 0.08 : 0.2, s.chroma, s.hue, alpha)
	const a = s.dark ? [0.4, 0.5, 0.6] : [0.06, 0.14, 0.22]
	return {
		'--backdrop': s.dark ? col(0.08, s.chroma, s.hue, 0.62) : col(0.2, s.chroma, s.hue, 0.42),
		'--shadow-pop': `0 1px 2px ${shade(a[0])}, 0 8px 28px ${shade(a[1])}`,
		'--shadow-modal': `0 2px 6px ${shade(a[0])}, 0 24px 64px ${shade(a[2])}`,
		'--av-l': s.dark ? '28%' : '88%',
		'--av-s': s.dark ? '28%' : '55%',
		'--av-tl': s.dark ? '84%' : '28%',
	}
}

/**
 * Every colour token for a time of day. A chosen accent hue replaces the drifting one, so the
 * accent picker still applies under Daylight.
 */
export function day_tokens(hour: number, accent_hue?: number) {
	const seed = day_seed(hour)
	const vars: Record<string, string> = {
		...surface_tokens(seed),
		...ink_tokens(seed),
		...accent_tokens(accent_hue ?? seed.accent_hue, seed.dark),
		...signal_tokens(seed),
		...depth_tokens(seed),
	}
	return { seed, vars }
}

/** Every token name Daylight writes, to clear them when the theme changes. */
export const DAY_VARS = Object.keys(day_tokens(12).vars)

/** `HH:MM` for minutes after midnight. */
export const hhmm = (minutes: number) =>
	`${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
