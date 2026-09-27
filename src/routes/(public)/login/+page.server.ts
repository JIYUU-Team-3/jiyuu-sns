import { fail, redirect } from '@sveltejs/kit'
import { APIError } from 'better-auth/api'
import { home_href, onboarding_href } from '../links'
import type { Actions, PageServerLoad } from './$types'

const GOOGLE_ORIGIN = 'https://accounts.google.com'

/**
 * Ask Better Auth for Google's consent URL, or undefined when it refuses.
 * A brand-new account comes back to onboarding to pick a handle; a returning one goes home.
 */
async function google_consent_url(auth: App.Locals['auth']) {
	try {
		const result = await auth.api.signInSocial({
			body: {
				provider: 'google',
				callbackURL: home_href(),
				newUserCallbackURL: onboarding_href(),
			},
		})
		return result.url
	} catch (error) {
		if (error instanceof APIError) return undefined
		throw error
	}
}

export const load: PageServerLoad = ({ locals }) => {
	if (locals.user) return redirect(302, home_href())
	return {}
}

export const actions: Actions = {
	google: async ({ locals }) => {
		const url = await google_consent_url(locals.auth)
		if (!url) return fail(502, { google_failed: true })
		return redirect(302, url, { external: [GOOGLE_ORIGIN] })
	},
}
