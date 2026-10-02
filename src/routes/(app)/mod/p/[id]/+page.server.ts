import { error, fail } from '@sveltejs/kit'
import { env } from 'cloudflare:workers'
import { is_rule } from '#lib/moderation/rules'
import { read_form } from '#lib/server/form'
import { require_moderator } from '#lib/server/moderation/guard'
import { block_domain, links_in } from '#lib/server/moderation/links'
import { block_media } from '#lib/server/moderation/media'
import { moderate_post, post_for_review, type PostAction } from '#lib/server/moderation/posts'
import { limit } from '#lib/server/rate-limit'
import type { Actions, PageServerLoad } from './$types'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NOTE_MAX = 500

export const load: PageServerLoad = async ({ locals, params }) => {
	const { db } = require_moderator(locals)
	const found = UUID.test(params.id) ? await post_for_review(db, params.id) : undefined
	if (!found) error(404, 'Not found.')
	return {
		hosts: [...new Set(links_in(found.body).map((link) => link.host))],
		post: {
			...found,
			created_at: found.created_at.getTime(),
			removed_at: found.removed_at?.getTime() ?? null,
			history: found.history.map((row) => ({
				...row,
				reason: is_rule(row.reason) ? row.reason : undefined,
				created_at: row.created_at.getTime(),
				reversed: row.reversed_at !== null,
			})),
		},
	}
}

const ACTIONS: PostAction[] = ['sensitive', 'unsensitive', 'limit', 'remove', 'restore']

export const actions: Actions = {
	default: async ({ locals, params, request }) => {
		const { db, user_id } = require_moderator(locals)
		await limit('MOD_LIMIT', user_id)
		if (!UUID.test(params.id)) error(404, 'Not found.')
		const data = await read_form(request, 4096)

		// Blocking acts on what the post holds, never on a domain or URL the form names freely.
		if (data.get('action') === 'block_domain' || data.get('action') === 'block_image') {
			const found = await post_for_review(db, params.id)
			if (!found) error(404, 'Not found.')
			const target = String(data.get('target') ?? '')
			if (data.get('action') === 'block_domain') {
				if (!links_in(found.body).some((link) => link.host === target))
					return fail(400, { invalid: true })
				await block_domain(db, target, user_id, 'malicious_link')
				return { blocked: target }
			}
			if (!found.media.some((item) => item.url === target)) return fail(400, { invalid: true })
			if (!(await block_media(db, env.MEDIA, target, user_id))) return fail(400, { invalid: true })
			return { blocked: target }
		}

		const action = String(data.get('action') ?? '') as PostAction
		const reason = data.get('reason')
		const note = String(data.get('note') ?? '').trim()
		if (!ACTIONS.includes(action) || [...note].length > NOTE_MAX)
			return fail(400, { invalid: true })
		// A removal names the rule it broke; it counts as a strike unless the moderator says not.
		if (action === 'remove' && !is_rule(reason)) return fail(400, { invalid: true })

		const done = await moderate_post(db, {
			moderator_id: user_id,
			post_id: params.id,
			action,
			reason: is_rule(reason) ? reason : undefined,
			strike: action === 'remove' && data.get('strike') !== 'no',
			note,
		})
		if (!done) return fail(409, { unchanged: true })
		return { done: action, suspended: done.suspended }
	},
}
