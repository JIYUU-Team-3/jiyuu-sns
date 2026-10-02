import { fail } from '@sveltejs/kit'
import { env } from 'cloudflare:workers'
import { delete_media } from '#lib/server/media'
import {
	purge_removed_posts,
	refuse_removal_review,
	uphold_removal_review,
} from '#lib/server/moderation/posts'
import {
	decide_review,
	dismiss_case,
	open_cases,
	open_reviews,
	reopen_review,
} from '#lib/server/moderation/cases'
import { require_moderator } from '#lib/server/moderation/guard'
import { uphold_suspension_review } from '#lib/server/moderation/standing'
import { read_form } from '#lib/server/form'
import { limit } from '#lib/server/rate-limit'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
	const { db } = require_moderator(locals)
	// Removed posts past their day go whenever the queue is opened, besides the hourly job.
	const { unused } = await purge_removed_posts(db)
	await delete_media(env.MEDIA, unused)
	const [cases, reviews] = await Promise.all([open_cases(db), open_reviews(db)])
	return { cases, reviews }
}

/** The one id a queue form sends, bounded. */
async function read_id(request: Request, field: string) {
	const data = await read_form(request, 1024)
	const id = String(data.get(field) ?? '')
	return { data, id: id.length > 0 && id.length <= 64 ? id : undefined }
}

export const actions: Actions = {
	dismiss: async ({ locals, request }) => {
		const { db, user_id } = require_moderator(locals)
		await limit('MOD_LIMIT', user_id)
		const { id } = await read_id(request, 'case')
		if (!id || !(await dismiss_case(db, user_id, id))) return fail(404, { missing: true })
	},

	decide: async ({ locals, request }) => {
		const { db, user_id } = require_moderator(locals)
		await limit('MOD_LIMIT', user_id)
		const { data, id } = await read_id(request, 'review')
		const upheld = data.get('decision') === 'uphold'
		if (!id) return fail(404, { missing: true })
		const decided = await decide_review(db, user_id, id, upheld)
		if (!decided) return fail(404, { missing: true })
		try {
			await act_on_review(db, user_id, decided, upheld)
		} catch (error) {
			// The decision only stands once it's carried out; otherwise it goes back in the queue.
			await reopen_review(db, user_id, id)
			throw error
		}
	},
}

/** Carry out a review decision on the action it was about, never on a newer one. */
async function act_on_review(
	db: ReturnType<typeof require_moderator>['db'],
	moderator_id: string,
	decided: NonNullable<Awaited<ReturnType<typeof decide_review>>>,
	upheld: boolean,
) {
	if (decided.action === 'suspend' && upheld) {
		await uphold_suspension_review(db, moderator_id, decided.user_id, decided.action_id)
	}
	if (decided.action === 'remove' && decided.target_kind === 'post') {
		// Upheld: the post comes back and the strike goes. Refused: it's deleted now, not tomorrow.
		if (upheld) {
			await uphold_removal_review(db, moderator_id, decided.target_id, decided.action_id)
		} else {
			const unused = await refuse_removal_review(db, decided.target_id, decided.action_id)
			await delete_media(env.MEDIA, unused)
		}
	}
}
