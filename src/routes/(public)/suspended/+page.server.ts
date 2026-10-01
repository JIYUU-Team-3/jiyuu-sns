import { fail, redirect } from '@sveltejs/kit'
import { localizeHref } from '#lib/paraglide/runtime'
import { is_rule, REVIEW_REQUEST_MAX } from '#lib/moderation/rules'
import { read_form } from '#lib/server/form'
import { find_suspension_details, request_review } from '#lib/server/moderation/standing'
import { limit } from '#lib/server/rate-limit'
import { home_href } from '../links'
import type { Actions, PageServerLoad } from './$types'

/** What a suspended account sees instead of the app. Anyone else has no business here. */
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) return redirect(302, localizeHref('/login'))
	const suspension = locals.standing?.suspension
	if (!suspension) return redirect(302, home_href())

	const details = suspension.action_id
		? await find_suspension_details(locals.db, locals.user.id, suspension.action_id)
		: undefined
	return {
		until: suspension.until,
		reason: is_rule(suspension.reason) ? suspension.reason : undefined,
		note: details?.note,
		review: details?.review,
	}
}

export const actions: Actions = {
	// Actions skip `load`, so each checks the session and the suspension itself.
	review: async ({ locals, request }) => {
		if (!locals.user) return redirect(302, localizeHref('/login'))
		const suspension = locals.standing?.suspension
		if (!suspension?.action_id) return redirect(302, home_href())
		await limit('WRITE_LIMIT', locals.user.id)

		const data = await read_form(request, REVIEW_REQUEST_MAX * 4)
		const body = String(data.get('body') ?? '').trim()
		if (!body || [...body].length > REVIEW_REQUEST_MAX) return fail(400, { body, invalid: true })

		const filed = await request_review(locals.db, locals.user.id, suspension.action_id, body)
		if (!filed) return fail(409, { body, already: true })
		return { sent: true }
	},

	signOut: async ({ locals, request }) => {
		await locals.auth.api.signOut({ headers: request.headers })
		return redirect(303, localizeHref('/login'))
	},
}
