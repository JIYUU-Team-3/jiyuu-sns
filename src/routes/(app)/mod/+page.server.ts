import { fail } from '@sveltejs/kit'
import { decide_review, dismiss_case, open_cases, open_reviews } from '#lib/server/moderation/cases'
import { require_moderator } from '#lib/server/moderation/guard'
import { lift_suspension } from '#lib/server/moderation/standing'
import { read_form } from '#lib/server/form'
import { limit } from '#lib/server/rate-limit'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
	const { db } = require_moderator(locals)
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
		if (upheld && decided.action === 'suspend') await lift_suspension(db, user_id, decided.user_id)
	},
}
