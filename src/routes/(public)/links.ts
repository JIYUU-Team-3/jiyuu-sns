import type { Path } from '$app/types'
import { resolve } from '$app/paths'
import { getLocale, localizeHref } from '#lib/paraglide/runtime'

const CONTACT_EMAIL = 'jiyuu.org@gmail.com'

const REPO_URL = 'https://github.com/JIYUU-Team-3/jiyuu-sns'

/** Outside destinations named by markup tags in messages, e.g. `{#email}…{/email}`. */
export const EXTERNAL_HREFS = {
	email: `mailto:${CONTACT_EMAIL}`,
	github: REPO_URL,
	issues: `${REPO_URL}/issues`,
	sveltekit: 'https://svelte.dev/docs/kit',
	cloudflare: 'https://www.cloudflare.com/',
	better_auth: 'https://www.better-auth.com/',
	google: 'https://policies.google.com/privacy',
	github_privacy:
		'https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement',
	cloudflare_privacy: 'https://www.cloudflare.com/privacypolicy/',
	giphy_privacy: 'https://giphy.com/privacy',
	giphy_terms: 'https://giphy.com/terms',
	komoot_privacy: 'https://www.komoot.com/privacy',
	osm: 'https://www.openstreetmap.org/copyright',
	jsdelivr_privacy: 'https://www.jsdelivr.com/terms/privacy-policy',
	wcag: 'https://www.w3.org/TR/WCAG22/',
}

/** An app path in the current locale, e.g. `/terms` → `/ja/terms`. */
export const localized = (path: '/about' | '/terms' | '/privacy' | '/accessibility' | '/login') =>
	resolve(localizeHref(path) as Path)

/** Where a signed-in user lands, kept in the locale they signed in from. */
export const home_href = () => localizeHref('/', { locale: getLocale() })

/** The one-screen profile setup a new account sees after its first Google sign-in. */
export const onboarding_href = () => localizeHref('/onboarding', { locale: getLocale() })
