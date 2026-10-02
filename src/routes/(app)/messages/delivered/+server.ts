import { error } from '@sveltejs/kit'
import { env } from 'cloudflare:workers'
import { mark_delivered_live } from '#lib/server/live'
import { mark_delivered } from '#lib/server/messages'
import { limit } from '#lib/server/rate-limit'
import type { RequestHandler } from './$types'

export const POST: RequestHandler = async ({ locals }) => {
	if (!locals.user) error(401, 'Sign in to continue.')
	await limit('LOOKUP_LIMIT', locals.user.id)
	const { db, user } = locals
	await mark_delivered_live(import.meta.env.DEV ? undefined : env.CHAT, () =>
		mark_delivered(db, user.id),
	)
	return new Response(null, { status: 204 })
}
