import { error, redirect } from '@sveltejs/kit'
import { find_profile_by_handle } from '#lib/server/profiles'
import type { PageServerLoad } from './$types'
import { login_href } from '../../../(public)/links'

export const load: PageServerLoad = async ({ locals, params, url }) => {
	// Runs alongside the layout's own check, so it must not tell a visitor which handles exist.
	if (!locals.user) return redirect(302, login_href(url))
	const profile = await find_profile_by_handle(locals.db, locals.user.id, params.handle)
	if (!profile) error(404, 'Profile not found.')
	return {}
}
