import { m } from '#lib/paraglide/messages.js'
import type { Locale } from '#lib/paraglide/runtime'
import { format_short_date } from '#lib/posts/format'
import { same_day } from './rules'
import type { MessageView } from './types'

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

/** The sentence for a system line, or undefined for a message somebody wrote. */
export function event_text(message: MessageView, deleted: string) {
	if (!message.event) return undefined
	const name = message.sender.name
	const target = message.event.target ?? deleted
	switch (message.event.kind) {
		case 'created':
			return m.dm_event_created({ name })
		case 'added':
			return m.dm_event_added({ name, target })
		case 'removed':
			return m.dm_event_removed({ name, target })
		case 'left':
			return m.dm_event_left({ name })
		case 'admin_on':
			return m.dm_event_admin_on({ name, target })
		case 'admin_off':
			return m.dm_event_admin_off({ name, target })
		case 'owner':
			return m.dm_event_owner({ name, target })
		case 'renamed':
			return message.body
				? m.dm_event_renamed({ name, group: message.body })
				: m.dm_event_name_cleared({ name })
		case 'photo':
			return m.dm_event_photo({ name })
	}
}
