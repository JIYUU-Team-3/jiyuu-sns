import { KHMER_MONTHS } from '#lib/format-date'
import { m } from '#lib/paraglide/messages.js'
import type { Locale } from '#lib/paraglide/runtime'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * Chromium ships ICU without Khmer and falls back to English, while Node formats real Khmer.
 * Khmer dates are built by hand and Khmer numbers use the English forms, so the server render
 * and the hydrated page agree.
 */
const intl_locale = (locale: Locale) => (locale === 'km' ? 'en' : locale)

type Zone = { time_zone?: string }

function parts(time: number, time_zone: string | undefined) {
	const f = new Intl.DateTimeFormat('en', {
		timeZone: time_zone,
		year: 'numeric',
		month: 'numeric',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		hourCycle: 'h23',
	})
	const get = (type: string) => Number(f.formatToParts(time).find((p) => p.type === type)?.value)
	return {
		year: get('year'),
		month: get('month') - 1,
		day: get('day'),
		hour: get('hour'),
		minute: get('minute'),
	}
}

/** `Sep 25`, or `Sep 25, 2025` once it isn't the current year. */
export function format_short_date(
	time: number,
	now: number,
	locale: Locale,
	{ time_zone }: Zone = {},
) {
	const { year, month, day } = parts(time, time_zone)
	const same_year = year === parts(now, time_zone).year
	if (locale === 'km') return `${day} ${KHMER_MONTHS[month]}${same_year ? '' : ` ${year}`}`
	return new Intl.DateTimeFormat(locale, {
		timeZone: time_zone,
		month: 'short',
		day: 'numeric',
		year: same_year ? undefined : 'numeric',
	}).format(time)
}

/** X's compact age for a post header: `now`, `5m`, `3h`, then a short date. */
export function format_age(time: number, now: number, locale: Locale, zone: Zone = {}) {
	const age = Math.max(0, now - time)
	if (age < MINUTE) return m.time_now({}, { locale })
	if (age < HOUR) return m.time_minutes({ count: Math.floor(age / MINUTE) }, { locale })
	if (age < DAY) return m.time_hours({ count: Math.floor(age / HOUR) }, { locale })
	return format_short_date(time, now, locale, zone)
}

/** The focus post's full timestamp, e.g. `10:25 AM · Sep 25, 2026`. */
export function format_timestamp(time: number, locale: Locale, { time_zone }: Zone = {}) {
	if (locale === 'km') {
		const { year, month, day, hour, minute } = parts(time, time_zone)
		const clock = `${hour}:${String(minute).padStart(2, '0')}`
		return `${clock} · ${day} ${KHMER_MONTHS[month]} ${year}`
	}
	const clock = new Intl.DateTimeFormat(locale, {
		timeZone: time_zone,
		hour: 'numeric',
		minute: '2-digit',
	}).format(time)
	const date = new Intl.DateTimeFormat(locale, {
		timeZone: time_zone,
		dateStyle: 'medium',
	}).format(time)
	return `${clock} · ${date}`
}

/** A running poll's time left, rounded down: `2 days left`, `5 hours left`, `3 minutes left`. */
export function format_time_left(ends_at: number, now: number, locale: Locale) {
	const left = Math.max(0, ends_at - now)
	if (left >= DAY) return m.poll_days_left({ count: Math.floor(left / DAY) }, { locale })
	if (left >= HOUR) return m.poll_hours_left({ count: Math.floor(left / HOUR) }, { locale })
	return m.poll_minutes_left({ count: Math.max(1, Math.floor(left / MINUTE)) }, { locale })
}

/** Engagement counts: `999`, `1.2K`, `12K`, `1.2M` (and `1.2万` in Japanese). */
export function format_count(count: number, locale: Locale) {
	// Like X, tens of thousands drop the decimal (12K, not 12.3K).
	const whole = count >= 10_000 && count < 1_000_000
	return new Intl.NumberFormat(intl_locale(locale), {
		notation: 'compact',
		maximumFractionDigits: whole ? 0 : 1,
	}).format(count)
}
