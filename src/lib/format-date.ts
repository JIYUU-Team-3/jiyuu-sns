/** CLDR Khmer month names, as Node's full ICU prints them for `month: 'long'`. */
export const KHMER_MONTHS = [
	'មករា',
	'កុម្ភៈ',
	'មីនា',
	'មេសា',
	'ឧសភា',
	'មិថុនា',
	'កក្កដា',
	'សីហា',
	'កញ្ញា',
	'តុលា',
	'វិច្ឆិកា',
	'ធ្នូ',
]

/** CLDR's long Khmer date pattern, `d MMMM y`, in UTC. */
function format_khmer_date(time: number): string {
	const date = new Date(time)
	return `${date.getUTCDate()} ${KHMER_MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`
}

/**
 * Format `time` as a long UTC date in `locale`. Chromium ships trimmed ICU data without
 * Khmer and silently falls back to English, so Khmer is formatted by hand everywhere.
 * That also keeps the server and client output identical during hydration.
 */
export function format_long_date(time: number, locale: string): string {
	if (locale === 'km') return format_khmer_date(time)
	return new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(time)
}

/** Format `time` as a UTC month and year in `locale`, e.g. `September 2026`. Khmer by hand, as above. */
export function format_month_year(time: number, locale: string): string {
	const date = new Date(time)
	if (locale === 'km') return `${KHMER_MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`
	return new Intl.DateTimeFormat(locale, {
		year: 'numeric',
		month: 'long',
		timeZone: 'UTC',
	}).format(time)
}

/** The twelve month names in `locale`, January first. Khmer by hand, as above. */
export function month_names(locale: string): string[] {
	if (locale === 'km') return KHMER_MONTHS
	const format = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' })
	return Array.from({ length: 12 }, (_, i) => format.format(Date.UTC(2000, i, 1)))
}

/**
 * A birthday in `locale`: month and day, e.g. `March 5`, or with the year when it's shown.
 * Khmer by hand, as above, in CLDR's `d MMMM` order.
 */
export function format_birthday(
	birthday: { month: number; day: number; year?: number },
	locale: string,
): string {
	const { month, day, year } = birthday
	if (locale === 'km') return [day, KHMER_MONTHS[month - 1], year].filter(Boolean).join(' ')
	const time = Date.UTC(year ?? 2000, month - 1, day)
	return new Intl.DateTimeFormat(locale, {
		month: 'long',
		day: 'numeric',
		...(year !== undefined && { year: 'numeric' }),
		timeZone: 'UTC',
	}).format(time)
}
