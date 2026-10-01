import { error, fail, redirect } from '@sveltejs/kit'
import { REVIEW_REQUEST_MAX } from '#lib/moderation/rules'
import { localizeHref } from '#lib/paraglide/runtime'
import { read_form } from '#lib/server/form'
import { post_notice, request_post_review } from '#lib/server/moderation/posts'
import { find_post } from '#lib/server/posts'
import { limit } from '#lib/server/rate-limit'
import type { Actions, PageServerLoad } from './$types'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** A missing or malformed id is a real 404 page, not an error inside the column. */
export const load: PageServerLoad = async ({ locals, params }) => {
	// Runs alongside the layout's own check, so it must not tell a visitor which posts exist.
	if (!locals.user) return redirect(302, localizeHref('/login'))
	const post = UUID.test(params.id)
		? await find_post(locals.db, locals.user.id, params.id)
		: undefined
	if (!post) error(404, 'Post not found.')
	// Only the author is ever shown a hidden post, so only they get the moderator's reasons.
	const notice = post.moderation ? await post_notice(locals.db, locals.user.id, post.id) : undefined
	return { notice }
}

export const actions: Actions = {
	// Actions skip `load`, so this checks the session itself; the review is scoped to the author.
	review: async ({ locals, params, request }) => {
		if (!locals.user) return redirect(302, localizeHref('/login'))
		if (!UUID.test(params.id)) error(404, 'Post not found.')
		await limit('WRITE_LIMIT', locals.user.id)
		const data = await read_form(request, REVIEW_REQUEST_MAX * 4)
		const body = String(data.get('body') ?? '').trim()
		if (!body || [...body].length > REVIEW_REQUEST_MAX) return fail(400, { body, invalid: true })
		if (!(await request_post_review(locals.db, locals.user.id, params.id, body))) {
			return fail(409, { body, refused: true })
		}
		return { sent: true }
	},
}
