import { sequence, type Handle } from '@sveltejs/kit/hooks'
import { env } from 'cloudflare:workers'
import { building } from '$app/env'
import { createAuth } from '#lib/server/auth'
import { getDb } from '#lib/server/db'
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
	}

	return svelteKitHandler({ event, resolve, auth, building })
}

export const handle: Handle = sequence(handleParaglide, handlePrefs, handleBetterAuth)
