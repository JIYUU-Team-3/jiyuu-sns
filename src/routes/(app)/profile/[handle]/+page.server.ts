import { error } from '@sveltejs/kit'
import { find_profile_view } from '#lib/server/profiles'
import type { PageServerLoad } from './$types'

/** An unknown handle is a real 404 page, not an empty profile. */
export const load: PageServerLoad = async ({ locals, params }) => {
	const profile = await find_profile_view(locals.db, locals.user?.id, params.handle)
	if (!profile) error(404, 'Profile not found.')
	return { profile }
}
