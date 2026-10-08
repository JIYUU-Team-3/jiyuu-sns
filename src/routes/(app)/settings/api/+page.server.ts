import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import { login_href } from '../../../(public)/links'

export const load: PageServerLoad = ({ locals, url }) => {
	if (!locals.user) return redirect(302, login_href(url))
	return {}
}
