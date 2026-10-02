import { error } from '@sveltejs/kit'
import { mark_delivered } from '#lib/server/messages'
import { limit } from '#lib/server/rate-limit'
import type { RequestHandler } from './$types'

export const POST: RequestHandler = async ({ locals }) => {
	if (!locals.user) error(401, 'Sign in to continue.')
	await limit('LOOKUP_LIMIT', locals.user.id)
	await mark_delivered(locals.db, locals.user.id)
	return new Response(null, { status: 204 })
}
