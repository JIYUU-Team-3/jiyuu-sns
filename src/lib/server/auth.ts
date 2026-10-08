import {
	ALLOW_EMAIL_SIGNUP,
	ORIGIN,
	BETTER_AUTH_SECRET,
	GOOGLE_CLIENT_ID,
	GOOGLE_CLIENT_SECRET,
} from '$app/env/private'

import { betterAuth } from 'better-auth/minimal'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { sveltekitCookies } from 'better-auth/svelte-kit'
import { getRequestEvent } from '$app/server'
import { getDb } from '#lib/server/db'

/**
 * Whether email and password accounts are on. They need no proof of the address, so they exist
 * only for the e2e tests: the flag is ignored unless the server itself runs at a loopback
 * address, so setting it on a deployment by mistake turns nothing on.
 */
export const email_signup =
	!!ALLOW_EMAIL_SIGNUP && /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(ORIGIN)

const authConfig = {
	baseURL: ORIGIN,
	secret: BETTER_AUTH_SECRET,
	// Instead of Better Auth's own error page. A sign-in started from /login names the same page in
	// its own language; this catches a callback too broken to know which sign-in it belongs to.
	onAPIError: { errorURL: '/session-ended' },
	// People sign in with Google; the e2e server has no Google to sign in with.
	emailAndPassword: { enabled: email_signup },
	// Every request needs the session, and the app polls. A signed copy in a cookie answers for
	// five minutes before D1 is asked again, so most requests skip two reads. Signing out clears
	// it at once; a session deleted elsewhere lasts at most that long. Suspensions don't wait:
	// they're read from `account_standing` on every request.
	session: { cookieCache: { enabled: true, maxAge: 5 * 60 } },
	socialProviders: {
		google: {
			clientId: GOOGLE_CLIENT_ID,
			clientSecret: GOOGLE_CLIENT_SECRET,
		},
	},
	plugins: [
		sveltekitCookies(getRequestEvent), // make sure this is the last plugin in the array
	],
} satisfies Omit<Parameters<typeof betterAuth>[0], 'database'>

const make = (d1: D1Database) =>
	betterAuth({
		...authConfig,
		database: drizzleAdapter(getDb(d1), { provider: 'sqlite' }),
	})

const instances = new WeakMap<D1Database, ReturnType<typeof make>>()

/** One instance per binding, built on the first request rather than on every one. */
export function createAuth(d1: D1Database) {
	if (!d1) return make(d1)
	let auth = instances.get(d1)
	if (!auth) instances.set(d1, (auth = make(d1)))
	return auth
}

/**
 * DO NOT USE!
 *
 * This instance is used by the `auth` CLI for schema generation ONLY.
 * To access `auth` at runtime, use `event.locals.auth`.
 */
export const auth = createAuth(null!)
