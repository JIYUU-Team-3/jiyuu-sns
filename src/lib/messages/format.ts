import { m } from '#lib/paraglide/messages.js'
import type { Locale } from '#lib/paraglide/runtime'
import { format_short_date } from '#lib/posts/format'
import { same_day } from './rules'

const DAY = 24 * 60 * 60 * 1000

const intl_locale = (locale: Locale) => (locale === 'km' ? 'en' : locale)

export function format_clock(time: number, locale: Locale) {
	return new Intl.DateTimeFormat(intl_locale(locale), {
		hour: 'numeric',
		minute: '2-digit',
	}).format(time)
}

export function format_day(time: number, now: number, locale: Locale) {
	if (same_day(time, now)) return m.dm_today({}, { locale })
	if (same_day(time, now - DAY)) return m.dm_yesterday({}, { locale })
	return format_short_date(time, now, locale)
}

export function format_list_time(time: number, now: number, locale: Locale) {
	if (same_day(time, now)) return format_clock(time, locale)
	return format_short_date(time, now, locale)
}
