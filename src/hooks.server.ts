import { sequence, type Handle } from '@sveltejs/kit/hooks'
import { env } from 'cloudflare:workers'
import { building, dev } from '$app/env'
import { DEV_AUTH_BYPASS } from '$app/env/private'
import { createAuth, email_signup } from '#lib/server/auth'
import { getDb } from '#lib/server/db'
import { allow_local_auth, local_developer } from '#lib/server/local-auth'
import { under_limit } from '#lib/server/rate-limit'
import { svelteKitHandler } from 'better-auth/svelte-kit'
import { getTextDirection } from '#lib/paraglide/runtime'
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
	} else if (allow_local_auth(dev, DEV_AUTH_BYPASS, event.url)) {
		event.locals.user = await local_developer(event.locals.db)
	}

	return svelteKitHandler({ event, resolve, auth, building })
}

export const handle: Handle = sequence(
	handleSecurityHeaders,
	handleParaglide,
	handlePrefs,
	handleAuthLimit,
	handleBetterAuth,
)
