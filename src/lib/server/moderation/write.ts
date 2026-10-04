import { error } from '@sveltejs/kit'
import { and, eq } from 'drizzle-orm'
import { gif_allowed } from '../gifs'
import type { getDb } from '../db'
import { post } from '../db/schema'
import { limit } from '../rate-limit'
import { raise_case } from './cases'
import { check_links, links_in, type LinkCheck } from './links'
import {
	is_limited,
	LIMITED_POSTS_PER_HOUR,
	posts_last_hour,
	repeats_own_post,
	use_allowance,
	type Allowance,
	type Trust,
} from './trust'

type Db = ReturnType<typeof getDb>

/**
 * Why a post or message was refused before it was saved. The client shows each one as a sentence;
 * see `#lib/moderation/refusals`.
 */
export type WriteRefusal =
	| (LinkCheck['refusal'] & string)
	| 'post_duplicate'
	| 'post_rate'
	| 'video_new_account'
	| 'link_daily_limit'
	| 'video_daily_limit'
	| 'gif_rating'

const refuse = (status: number, code: WriteRefusal): never => error(status, code)

const DAILY_LIMIT = { links: 'link_daily_limit', videos: 'video_daily_limit' } as const

/**
 * A new account's links and videos come out of its daily allowance, as the last check before
 * saving, so a refused post costs nothing. Other accounts have no allowance to use.
 */
async function within_allowance(
	db: Db,
	user_id: string,
	trust: Trust,
	wanted: Partial<Record<Allowance, number>>,
) {
	if (trust !== 'new') return
	const out = await use_allowance(db, user_id, wanted)
	if (out) refuse(429, DAILY_LIMIT[out])
}

const has_links = (body: string) => links_in(body).length > 0

/** Look the links up, once per post, under a limit: each lookup is a request to Cloudflare. */
async function links_checked(db: Db, user_id: string, body: string, trust: Trust) {
	const result = await check_links(db, body, {
		can_link: trust !== 'restricted',
		before_lookup: () => limit('LINK_LOOKUP_LIMIT', user_id),
	})
	if (result.refusal) refuse(result.refusal === 'link_new_account' ? 403 : 400, result.refusal)
	return result
}

type Draft = { body: string; media: { kind: 'image' | 'gif' | 'video'; url: string }[] }

/**
 * Everything a new post or thread must pass before it's saved: the pace and the media allowed for
 * the account's trust, no copy of its own recent posts, GIFs the picker would have offered, and
 * links that are neither disguised nor known bad. Throws the refusal; returns what to flag.
 */
export async function check_new_posts(db: Db, user_id: string, trust: Trust, drafts: Draft[]) {
	const videos = drafts.flatMap((draft) => draft.media.filter((media) => media.kind === 'video'))
	if (is_limited(trust)) {
		if (videos.length && trust === 'restricted') refuse(403, 'video_new_account')
		if ((await posts_last_hour(db, user_id)) + drafts.length > LIMITED_POSTS_PER_HOUR)
			refuse(429, 'post_rate')
	}
	if (
		await repeats_own_post(
			db,
			user_id,
			drafts.map((draft) => draft.body),
		)
	)
		refuse(400, 'post_duplicate')

	const gifs = drafts.flatMap((draft) => draft.media.filter((media) => media.kind === 'gif'))
	for (const gif of gifs) if (!(await gif_allowed(gif.url))) refuse(400, 'gif_rating')

	// Each post's risky links, in the thread's order, so only the posts that carry them are flagged.
	const risky: string[][] = []
	for (const draft of drafts)
		risky.push((await links_checked(db, user_id, draft.body, trust)).risky)
	await within_allowance(db, user_id, trust, {
		links: drafts.filter((draft) => has_links(draft.body)).length,
		videos: videos.length,
	})
	return { risky }
}

/**
 * Links in edited text pass the same checks as new ones; an edit can't sneak one in. An edit that
 * adds a link the post didn't have uses a new account's allowance like a new post would.
 */
export async function check_edited_post(
	db: Db,
	user_id: string,
	trust: Trust,
	id: string,
	body: string,
) {
	const result = await links_checked(db, user_id, body, trust)
	if (trust === 'new' && has_links(body)) {
		const [before] = await db
			.select({ body: post.body })
			.from(post)
			.where(and(eq(post.id, id), eq(post.authorId, user_id)))
			.limit(1)
		const had = new Set(links_in(before?.body ?? '').map((link) => link.href))
		// No post of theirs: the update finds nothing either, so there's nothing to charge for.
		if (before && links_in(body).some((link) => !had.has(link.href)))
			await within_allowance(db, user_id, trust, { links: 1 })
	}
	return result
}

/** A message's links pass the same checks as a post's. Only the host names are looked at. */
export async function check_message(db: Db, user_id: string, trust: Trust, body: string) {
	const result = await links_checked(db, user_id, body, trust)
	if (has_links(body)) await within_allowance(db, user_id, trust, { links: 1 })
	return result
}

/** Put allowed but risky links (shorteners, files to run) in front of a moderator. */
export async function flag_risky_links(
	db: Db,
	user_id: string,
	post_ids: string[],
	risky: string[][],
) {
	for (const [i, id] of post_ids.entries()) {
		const links = risky[i]
		if (!links?.length) continue
		await raise_case(db, { kind: 'post', id, user_id }, { weight: 1, flags: { links } })
	}
}
