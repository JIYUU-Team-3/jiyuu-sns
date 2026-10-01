import { error, redirect } from '@sveltejs/kit'
import { localizeHref } from '#lib/paraglide/runtime'
import { find_post } from '#lib/server/posts'
import type { PageServerLoad } from './$types'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** A missing or malformed id is a real 404 page, not an error inside the column. */
export const load: PageServerLoad = async ({ locals, params }) => {
	// Runs alongside the layout's own check, so it must not tell a visitor which posts exist.
	if (!locals.user) return redirect(302, localizeHref('/login'))
	const post = UUID.test(params.id)
		? await find_post(locals.db, locals.user.id, params.id)
		: undefined
	if (!post) error(404, 'Post not found.')
	return {}
}
