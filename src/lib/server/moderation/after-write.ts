import { env, waitUntil } from 'cloudflare:workers'
import type { getDb } from '../db'
import { announce_post } from '../notifications'
import { ai_enabled } from './ai-client'
import { check_post, check_profile, type CheckDeps } from './checks'

type Db = ReturnType<typeof getDb>

/** What the checks need from the Worker: the bucket, the image resizer, and whether AI is on. */
export const check_deps = (): CheckDeps => ({
	bucket: env.MEDIA,
	images: env.IMAGES,
	enabled: ai_enabled(),
})

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
	// One post's failure leaves it `pending` for the hourly job; the rest of the thread still runs.
	for (const id of post_ids) later(async () => check_post(db, check_deps(), id, budget))
}

/**
 * A new top-level post or quote: check it, then tell the followers who asked, unless the check hid
 * it. A failed check leaves it showing, as it does for everyone, so it is still announced.
 */
export function check_then_announce_later(db: Db, post_id: string) {
	later(async () => {
		try {
			await check_post(db, check_deps(), post_id)
		} finally {
			await announce_post(db, post_id)
		}
	})
}

/** A profile whose bio, photo or banner just changed. */
export function check_profile_later(db: Db, user_id: string) {
	later(() => check_profile(db, check_deps(), user_id))
}
