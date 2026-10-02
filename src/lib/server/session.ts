import { error } from '@sveltejs/kit'
import { getRequestEvent } from '$app/server'
import { find_profile } from './profiles'
import { limit, type Limiter } from './rate-limit'

/**
 * The signed-in account. Posts, profiles and search are for signed-in people only, and remote
 * functions are their own endpoints that no layout guards, so every one of them starts here.
 * A suspended account is refused here too, behind the hook that already turns it away.
 */
export function signed_in() {
	const { locals } = getRequestEvent()
	if (!locals.user) error(401, 'Sign in to continue.')
	if (locals.standing?.suspension) error(403, 'This account is suspended.')
	return { db: locals.db, user_id: locals.user.id }
}

/**
 * Every write goes through here: a session, a finished profile (so nobody posts without a
 * handle), and a pace a person could keep up. Chatting is faster than posting, so it counts
 * against `MESSAGE_LIMIT` instead.
 */
export async function member(limiter: Limiter = 'WRITE_LIMIT') {
	const me = signed_in()
	await limit(limiter, me.user_id)
	if (!(await find_profile(me.db, me.user_id))) error(403, 'Finish setting up your profile.')
	return me
}

/**
 * Every moderation tool starts here. The role comes from `account_standing`, keyed by user id, so
 * whoever later holds the moderator's old handle gets nothing. Others get a 404, as if the tools
 * weren't there.
 */
export function moderator() {
	const me = signed_in()
	if (getRequestEvent().locals.standing?.role !== 'moderator') error(404, 'Not found.')
	return me
}
