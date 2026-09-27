/** CLDR Khmer month names, as Node's full ICU prints them for `month: 'long'`. */
const KHMER_MONTHS = [
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
