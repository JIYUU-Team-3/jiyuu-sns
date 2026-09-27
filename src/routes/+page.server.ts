import { redirect } from '@sveltejs/kit'
import { home_href } from './(public)/links'
import type { Actions, PageServerLoad } from './$types'

// Temporary: the home feed will replace this page, and signed-out visitors will go to /login.
export const load: PageServerLoad = ({ locals }) => ({ signed_in: !!locals.user })

export const actions: Actions = {
	signOut: async ({ locals, request }) => {
		await locals.auth.api.signOut({ headers: request.headers })
		// A fresh request re-reads the session; rendering now would reuse the signed-in locals.
		return redirect(303, home_href())
	},
}
