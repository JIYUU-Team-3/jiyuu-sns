import { fail, redirect } from '@sveltejs/kit'
import { APIError } from 'better-auth/api'
import { read_form } from '#lib/server/form'
import { limit } from '#lib/server/rate-limit'
import { home_href, onboarding_href, session_ended_href } from '../links'
import { safe_next, with_next } from './next'
import type { Actions, PageServerLoad } from './$types'

const GOOGLE_ORIGIN = 'https://accounts.google.com'

/**
 * Ask Better Auth for Google's consent URL, or undefined when it refuses.
 * A brand-new account comes back to onboarding to pick a handle; a returning one goes home, or
 * back to the link that sent it here.
 */
async function google_consent_url(auth: App.Locals['auth'], next: string | undefined) {
	try {
		const result = await auth.api.signInSocial({
			body: {
				provider: 'google',
				callbackURL: next ?? home_href(),
				newUserCallbackURL: with_next(onboarding_href(), next),
				errorCallbackURL: session_ended_href(),
			},
		})
		return result.url
	} catch (error) {
		if (error instanceof APIError) return undefined
		throw error
	}
}

export const load: PageServerLoad = ({ locals, url }) => {
	const next = safe_next(url.searchParams.get('next'))
	if (locals.user) return redirect(302, next ?? home_href())
	return { next }
}

export const actions: Actions = {
	google: async ({ locals, request, getClientAddress }) => {
		// Each start stores a state row, so an address can only start so many a minute.
		await limit('AUTH_LIMIT', getClientAddress())
		const next = safe_next((await read_form(request, 4096)).get('next'))
		const url = await google_consent_url(locals.auth, next)
		if (!url) return fail(502, { google_failed: true })
		return redirect(302, url, { external: [GOOGLE_ORIGIN] })
	},
}
