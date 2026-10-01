import { error, json } from '@sveltejs/kit'
import { env } from 'cloudflare:workers'
import { ai_enabled } from '#lib/server/moderation/ai-client'
import { CRON_TOKEN, run_hourly } from '#lib/server/moderation/hourly'
import type { RequestHandler } from './$types'

/**
 * The hourly moderation job. Only the Worker's own `scheduled` handler can run it: it sets a fresh
 * random token in this isolate and sends it with an in-process request. Anyone else gets a 404.
 */
export const POST: RequestHandler = async ({ locals, request }) => {
	const token = (globalThis as Record<symbol, unknown>)[CRON_TOKEN]
	if (typeof token !== 'string' || request.headers.get('x-cron-token') !== token) {
		error(404, 'Not found.')
	}
	const summary = await run_hourly(locals.db, { bucket: env.MEDIA, enabled: ai_enabled() })
	return json(summary)
}
