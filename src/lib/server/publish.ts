import { error } from '@sveltejs/kit'
import { env, waitUntil } from 'cloudflare:workers'
import type { ReplyAudience } from '#lib/safety/rules'
import type { getDb } from './db'
import { ensure_preview, preview_link } from './link-preview'
import { check_posts_later } from './moderation/after-write'
import { sensitive_uploads } from './moderation/checks'
import { trust_level } from './moderation/trust'
import { check_new_posts, flag_risky_links } from './moderation/write'
import * as posts from './posts'

type Db = ReturnType<typeof getDb>

/** Most link pages one publish reads; a thread's other links get no card. */
const PREVIEWS_PER_PUBLISH = 3
/** How long publishing waits for them, so the new post usually comes back with its card. */
const PREVIEW_WAIT_MS = 2500

/**
 * Read the pages behind the posts' links, waiting a little so the card is there when the post is
 * shown; whatever takes longer finishes after the response and shows on the next load.
 */
export async function previews(db: Db, bodies: string[]) {
	const links = [...new Set(bodies.map(preview_link).filter((link) => link !== undefined))]
	const reading = Promise.all(
		links
			.slice(0, PREVIEWS_PER_PUBLISH)
			.map((link) => ensure_preview(db, { bucket: env.MEDIA }, link).catch(() => undefined)),
	)
	waitUntil(reading)
	await Promise.race([reading, new Promise((resolve) => setTimeout(resolve, PREVIEW_WAIT_MS))])
}

/**
 * Save a post or thread by `user_id`, past every write check, and return the new ids. The one
 * way to publish, for the composer and the API alike; the caller has already checked the session
 * or key, the profile and the write limit, and that the media is the author's own.
 */
export async function publish_posts(
	db: Db,
	user_id: string,
	drafts: posts.NewPost[],
	reply_to: string | undefined,
	audience: ReplyAudience,
) {
	// A photo found sensitive while it was being written goes behind the cover whatever was ticked.
	const flagged = await sensitive_uploads(
		db,
		drafts.flatMap((draft) => draft.media.map((media) => media.url)),
	)
	const prepared = drafts.map((draft) =>
		draft.media.some((media) => flagged.has(media.url)) ? { ...draft, sensitive: true } : draft,
	)
	const trust = await trust_level(db, user_id)
	const { risky } = await check_new_posts(db, user_id, trust, prepared)
	const ids = await posts.insert_thread(db, user_id, prepared, reply_to, audience)
	if (!ids) error(404, 'The post you replied to or quoted was deleted.')
	if (ids === 'closed') error(403, 'replies_closed')
	if (ids === 'private') error(403, 'private_post')
	await flag_risky_links(db, user_id, ids, risky)
	check_posts_later(db, ids)
	await previews(
		db,
		prepared.filter((draft) => draft.link_preview !== false).map((draft) => draft.body),
	)
	return ids
}
