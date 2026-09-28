import { error } from '@sveltejs/kit'
import { find_profile_by_handle } from '#lib/server/profiles'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals, params }) => {
	const profile = await find_profile_by_handle(locals.db, locals.user?.id, params.handle)
	if (!profile) error(404, 'Profile not found.')
	return {}
}
