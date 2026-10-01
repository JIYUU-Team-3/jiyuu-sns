/*
 * Display preferences. They belong to the device, not the account (the same as the mockup), and
 * live in a cookie so the server can paint the right theme into the first byte of HTML.
 */
import * as v from 'valibot'
import { accent_hue, ACCENTS } from './accents'
import { day_tokens } from './daylight'

export const THEMES = ['system', 'light', 'dark', 'daylight'] as const
export type Theme = (typeof THEMES)[number]
export type Accent = (typeof ACCENTS)[number]

const Schema = v.object({
	theme: v.fallback(v.picklist(THEMES), 'system'),
	accent: v.fallback(v.picklist(ACCENTS), 'blue'),
	/** Transparent background, for translucent browsers. Desktop only. */
	clear: v.fallback(v.boolean(), false),
	/** Calm animations even when the device doesn't ask for it. */
	reduce_motion: v.fallback(v.boolean(), false),
	autoplay: v.fallback(v.boolean(), true),
	/** Show media marked sensitive without the cover that asks first. */
	show_sensitive: v.fallback(v.boolean(), false),
})

export type Prefs = v.InferOutput<typeof Schema>

export const PREFS_COOKIE = 'jiyuu-prefs'
/** The device's UTC offset in minutes, as `Date#getTimezoneOffset` gives it, for Daylight. */
export const TZ_COOKIE = 'jiyuu-tz'
/** About 400 days, the longest browsers keep a cookie. */
export const COOKIE_MAX_AGE = 34_560_000

export const DEFAULT_PREFS: Prefs = v.parse(Schema, {})

/** Every field from the cookie that's valid; anything else falls back to its default. */
export function parse_prefs(cookie: string | undefined): Prefs {
	const raw: Record<string, string | boolean> = {}
	for (const [key, value] of new URLSearchParams(cookie ?? '')) {
		raw[key] = value === '1' ? true : value === '0' ? false : value
	}
	return v.parse(Schema, raw)
}

/** Only what differs from the defaults, so a new default reaches everyone who never chose. */
export function serialize_prefs(prefs: Prefs) {
	const params = new URLSearchParams()
	for (const key of Object.keys(DEFAULT_PREFS) as (keyof Prefs)[]) {
		const value = prefs[key]
		if (value === DEFAULT_PREFS[key]) continue
		params.set(key, typeof value === 'boolean' ? (value ? '1' : '0') : value)
	}
	return params.toString()
}

/** The offset from the cookie, or 0 (UTC) when it's missing or nonsense. */
export function parse_tz(cookie: string | undefined) {
	const offset = Number(cookie)
	return Number.isInteger(offset) && Math.abs(offset) <= 16 * 60 ? offset : 0
}

/** Minutes after local midnight for a UTC offset as `getTimezoneOffset` gives it. */
export function local_minutes(now: Date, tz_offset: number) {
	const utc = now.getUTCHours() * 60 + now.getUTCMinutes()
	return (((utc - tz_offset) % 1440) + 1440) % 1440
}

/** Daylight's colours for a time, plus the colour scheme they need. */
export function daylight_vars(minutes: number, accent: Accent): Record<string, string> {
	const { seed, vars } = day_tokens(minutes / 60, accent_hue(accent))
	return { ...vars, 'color-scheme': seed.dark ? 'dark' : 'light' }
}

/** Daylight's colours as inline `style` text for the root element. */
const daylight_style = (minutes: number, accent: Accent) =>
	Object.entries(daylight_vars(minutes, accent))
		.map(([k, value]) => `${k}: ${value}`)
		.join('; ')

/**
 * The root element's attributes for these preferences. Every value is from a whitelist or
 * computed here, never copied from the cookie, so it's safe to splice into the HTML.
 */
export function root_attributes(prefs: Prefs, minutes: number) {
	const attrs: string[] = []
	if (prefs.theme !== 'system') attrs.push(`data-theme="${prefs.theme}"`)
	if (prefs.accent !== 'blue') attrs.push(`data-accent="${prefs.accent}"`)
	if (prefs.clear) attrs.push('data-clear')
	if (prefs.reduce_motion) attrs.push('data-motion="reduce"')
	if (prefs.theme === 'daylight') attrs.push(`style="${daylight_style(minutes, prefs.accent)}"`)
	return attrs.join(' ')
}
