import { error } from '@sveltejs/kit'

/**
 * For `/mod` page loads and form actions, which aren't remote functions and so can't use
 * `moderator()`. Each one calls this itself: actions skip layout loads. Anyone else gets a 404.
 */
export function require_moderator(locals: App.Locals) {
	if (!locals.user || locals.standing?.role !== 'moderator') error(404, 'Not found.')
	return { db: locals.db, user_id: locals.user.id }
}
