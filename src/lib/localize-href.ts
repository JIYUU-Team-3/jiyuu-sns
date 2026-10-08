import { getLocale, getUrlOrigin, localizeHref as localize } from '#lib/paraglide/runtime'

const hrefs = new Map<string, string>()
const HREFS_MAX = 2000

/**
 * Paraglide's `localizeHref`, remembered: it parses a whole URL each time, and a page of posts
 * asks for a few links per post. Calls naming another locale aren't remembered.
 */
export function localizeHref(href: string, options?: { locale?: ReturnType<typeof getLocale> }) {
	if (options?.locale) return localize(href, options)
	const key = `${getUrlOrigin()}|${getLocale()}|${href}`
	let localized = hrefs.get(key)
	if (localized === undefined) {
		if (hrefs.size >= HREFS_MAX) hrefs.clear()
		hrefs.set(key, (localized = localize(href)))
	}
	return localized
}
