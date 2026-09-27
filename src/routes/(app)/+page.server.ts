import { redirect } from '@sveltejs/kit'
import { home_href } from '../(public)/links'
import type { Actions } from './$types'

export const actions: Actions = {
	signOut: async ({ locals, request }) => {
		await locals.auth.api.signOut({ headers: request.headers })
		// A fresh request re-reads the session; the signed-out home then sends the visitor to /login.
		return redirect(303, home_href())
	},
}
