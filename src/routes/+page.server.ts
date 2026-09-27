import type { Actions, PageServerLoad } from './$types'

// Temporary: the home feed will replace this page, and signed-out visitors will go to /login.
export const load: PageServerLoad = ({ locals }) => ({ signed_in: !!locals.user })

export const actions: Actions = {
	signOut: async ({ locals, request }) => {
		await locals.auth.api.signOut({ headers: request.headers })
	},
}
