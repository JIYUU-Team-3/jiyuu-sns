import { error } from '@sveltejs/kit'
import * as v from 'valibot'
import { command } from '$app/server'
import { locales } from '#lib/paraglide/runtime'
import { limit } from '#lib/server/rate-limit'
import { signed_in } from '#lib/server/session'
import { translate_post, type TranslateRefusal } from '#lib/server/translate'

const STATUS: Record<TranslateRefusal, number> = {
	not_found: 404,
	same_language: 400,
	unavailable: 503,
	busy: 503,
}

/**
 * "Translate post": the post's text in the reader's language. A command, not a query, since each
 * one may cost a model call; the server caches the answer for everyone else.
 */
export const translate = command(
	v.object({ id: v.pipe(v.string(), v.uuid()), to: v.picklist(locales) }),
	async ({ id, to }) => {
		const { db, user_id } = signed_in()
		await limit('TRANSLATE_LIMIT', user_id)
		const result = await translate_post(db, user_id, id, to)
		if (typeof result === 'string') error(STATUS[result], result)
		return result
	},
)
