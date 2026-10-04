import { redirect } from '@sveltejs/kit'
import { home_href } from '../links'
import type { PageServerLoad } from './$types'

/**
 * Where Better Auth sends a sign-in that didn't finish, such as Cancel on Google's consent screen.
 * It adds `?error=…`, which is never read: the page says the same thing whatever went wrong.
 */
export const load: PageServerLoad = ({ locals }) => {
	if (locals.user) return redirect(302, home_href())
}
