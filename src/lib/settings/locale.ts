import {
	defineCustomClientStrategy,
	defineCustomServerStrategy,
	type Locale,
	localizeUrl,
	toLocale,
} from '#lib/paraglide/runtime'
import { COOKIE_MAX_AGE } from './prefs'

/**
 * The language picked in the language picker. Only the picker writes it: paraglide's own cookie
 * is also written by just opening a page, which would pin a visitor to a shared link's language.
 */
const LANG_COOKIE = 'jiyuu-lang'
const LANG_PATTERN = new RegExp(`(?:^|;\\s*)${LANG_COOKIE}=([^;]*)`)

/** The picked language in a `Cookie` header or `document.cookie`, if any. */
const chosen_locale = (cookies: string | null) => toLocale(cookies?.match(LANG_PATTERN)?.[1])

export function define_chosen_strategy() {
	defineCustomServerStrategy('custom-chosen', {
		getLocale: (request) => chosen_locale(request?.headers.get('cookie') ?? null),
	})
	defineCustomClientStrategy('custom-chosen', {
		getLocale: () => chosen_locale(document.cookie),
		setLocale: () => {},
	})
}

export function switch_locale(locale: Locale) {
	document.cookie = `${LANG_COOKIE}=${locale}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`
	location.replace(localizeUrl(location.href, { locale }).href)
}

export function reload_if_stale_locale() {
	const chosen = chosen_locale(document.cookie)
	if (chosen && chosen !== document.documentElement.lang) location.reload()
}
