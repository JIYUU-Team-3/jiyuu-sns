import { env, waitUntil } from 'cloudflare:workers'
import type { getDb } from '../db'
import { ai_enabled } from './ai-client'
import { check_post, check_profile, type CheckDeps } from './checks'

type Db = ReturnType<typeof getDb>

const deps = (): CheckDeps => ({ bucket: env.MEDIA, enabled: ai_enabled() })

/**
 * Run a check after the response has gone, so nobody waits for Workers AI. A failure is logged and
 * leaves the post `pending` or `unchecked` for the hourly job; it never reaches the person.
 */
function later(task: () => Promise<unknown>) {
	waitUntil(
		task().catch((error: unknown) => {
			console.error('Moderation check failed', error)
		}),
	)
}

/** New or edited posts, in order. */
export function check_posts_later(db: Db, post_ids: string[], budget: 'text' | 'report' = 'text') {
	later(async () => {
		for (const id of post_ids) await check_post(db, deps(), id, budget)
	})
}

/** A profile whose bio, photo or banner just changed. */
export function check_profile_later(db: Db, user_id: string) {
	later(() => check_profile(db, deps(), user_id))
}
