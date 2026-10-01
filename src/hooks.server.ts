import { sequence, type Handle } from '@sveltejs/kit/hooks'
import { env } from 'cloudflare:workers'
import { building } from '$app/env'
import { createAuth, email_signup } from '#lib/server/auth'
import { getDb } from '#lib/server/db'
import { find_standing } from '#lib/server/moderation/standing'
import { under_limit } from '#lib/server/rate-limit'
import { svelteKitHandler } from 'better-auth/svelte-kit'
import { deLocalizeUrl, getTextDirection, localizeHref } from '#lib/paraglide/runtime'
import { paraglideMiddleware } from '#lib/paraglide/server'
import {
	PREFS_COOKIE,
	TZ_COOKIE,
	local_minutes,
	parse_prefs,
	parse_tz,
	root_attributes,
} from '#lib/settings/prefs'

const handleParaglide: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request, locale }) => {
		// Kit 3 made `RequestEvent.request` readonly, but paraglide's documented
		// SvelteKit integration swaps in the de-localized request here. The cast
		// keeps that exact runtime behaviour; removing the assignment instead
		// would lean on the `reroute` hook in src/hooks.ts, which is a behaviour
		// change, not a type fix.
		;(event as { request: Request }).request = request

		return resolve(event, {
			transformPageChunk: ({ html }) =>
				html
					.replace('%paraglide.lang%', locale)
					.replace('%paraglide.dir%', getTextDirection(locale)),
		})
	})

/** Paints the device's theme, accent and the rest onto <html>, so the first frame is right. */
const handlePrefs: Handle = ({ event, resolve }) => {
	const prefs = parse_prefs(event.cookies.get(PREFS_COOKIE))
	event.locals.prefs = prefs
	const minutes = local_minutes(new Date(), parse_tz(event.cookies.get(TZ_COOKIE)))
	return resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%jiyuu.root%', root_attributes(prefs, minutes)),
	})
}

/**
 * Sent with every response. The Content-Security-Policy itself comes from `csp` in
 * vite.config.ts, since SvelteKit has to add its own nonces to it.
 */
const SECURITY_HEADERS = {
	'x-frame-options': 'DENY',
	'x-content-type-options': 'nosniff',
	'referrer-policy': 'strict-origin-when-cross-origin',
	'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()',
	'strict-transport-security': 'max-age=31536000',
}

const handleSecurityHeaders: Handle = async ({ event, resolve }) => {
	const response = await resolve(event)
	try {
		for (const [name, value] of Object.entries(SECURITY_HEADERS)) response.headers.set(name, value)
		return response
	} catch {
		// Some responses (a redirect built by `Response.redirect`) have headers that can't change.
		const copy = new Response(response.body, response)
		for (const [name, value] of Object.entries(SECURITY_HEADERS)) copy.headers.set(name, value)
		return copy
	}
}

/**
 * Better Auth's endpoints are open to anyone, and several write to the database, so each
 * address gets a limited number of calls a minute. Off on the e2e server, where every test signs
 * up from the same address.
 */
const handleAuthLimit: Handle = async ({ event, resolve }) => {
	if (
		!email_signup &&
		event.request.method === 'POST' &&
		event.url.pathname.startsWith('/api/auth/') &&
		!(await under_limit('AUTH_LIMIT', event.getClientAddress()))
	) {
		return new Response('Too many requests.', { status: 429 })
	}
	return resolve(event)
}

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	// adapter-cloudflare (Kit 3) no longer populates `event.platform.env`;
	// bindings come from the `cloudflare:workers` runtime module.
	if (!env.DB) throw new Error('D1 binding "DB" not found - are you running with wrangler?')

	event.locals.auth = createAuth(env.DB)
	event.locals.db = getDb(env.DB)

	const { auth } = event.locals
	const session = await auth.api.getSession({ headers: event.request.headers })

	if (session) {
		event.locals.session = session.session
		event.locals.user = session.user
		event.locals.standing = await find_standing(event.locals.db, session.user.id)
	}

	// A suspended account may still read its session and sign out, and change nothing else.
	if (
		event.locals.standing?.suspension &&
		event.url.pathname.startsWith('/api/auth/') &&
		!SUSPENDED_AUTH_PATHS.has(event.url.pathname)
	) {
		return new Response('This account is suspended.', { status: 403 })
	}

	return svelteKitHandler({ event, resolve, auth, building })
}

const SUSPENDED_AUTH_PATHS = new Set(['/api/auth/get-session', '/api/auth/sign-out'])

/** What a suspended account can still open: its suspension page and the public documents. */
const SUSPENDED_PAGES = new Set([
	'/suspended',
	'/guidelines',
	'/terms',
	'/privacy',
	'/about',
	'/accessibility',
])

/**
 * A suspended account sees `/suspended` and nothing else of the app: pages redirect there, page
 * data asks the client to go there, and every other request (remote functions, media, uploads)
 * gets a 403. One gate here, so no route can forget it; `signed_in()` checks again behind it.
 */
const handleSuspended: Handle = ({ event, resolve }) => {
	if (!event.locals.standing?.suspension) return resolve(event)

	const path = deLocalizeUrl(event.url).pathname
	const page = path.replace(/\/__data\.json$/, '') || '/'
	if (SUSPENDED_PAGES.has(page) || path.startsWith('/_app/immutable/')) return resolve(event)

	const location = localizeHref('/suspended')
	if (event.request.method === 'GET' && path.endsWith('/__data.json')) {
		return Response.json({ type: 'redirect', location })
	}
	if (
		event.request.method === 'GET' &&
		event.request.headers.get('accept')?.includes('text/html')
	) {
		return new Response(null, { status: 303, headers: { location } })
	}
	return new Response('This account is suspended.', { status: 403 })
}

export const handle: Handle = sequence(
	handleSecurityHeaders,
	handleParaglide,
	handlePrefs,
	handleAuthLimit,
	handleBetterAuth,
	handleSuspended,
)
