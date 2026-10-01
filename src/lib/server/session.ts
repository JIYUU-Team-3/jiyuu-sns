import { error } from '@sveltejs/kit'
import { getRequestEvent } from '$app/server'
import { find_profile } from './profiles'
import { limit } from './rate-limit'

/**
 * The signed-in account. Posts, profiles and search are for signed-in people only, and remote
 * functions are their own endpoints that no layout guards, so every one of them starts here.
 */
export function signed_in() {
	const { locals } = getRequestEvent()
	if (!locals.user) error(401, 'Sign in to continue.')
	return { db: locals.db, user_id: locals.user.id }
}

/**
 * Every write goes through here: a session, a finished profile (so nobody posts without a
 * handle), and a pace a person could keep up.
 */
export async function member() {
	const me = signed_in()
	await limit('WRITE_LIMIT', me.user_id)
	if (!(await find_profile(me.db, me.user_id))) error(403, 'Finish setting up your profile.')
	return me
}
