import { error } from '@sveltejs/kit'
import { gif_allowed } from '../gifs'
import type { getDb } from '../db'
import { limit } from '../rate-limit'
import { raise_case } from './cases'
import { check_links, type LinkCheck } from './links'
import {
	is_limited,
	LIMITED_POSTS_PER_HOUR,
	posts_last_hour,
	repeats_own_post,
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
	| 'gif_rating'

const refuse = (status: number, code: WriteRefusal): never => error(status, code)

/** Look the links up, once per post, under a limit: each lookup is a request to Cloudflare. */
async function links_checked(db: Db, user_id: string, body: string, trust: Trust) {
	const result = await check_links(db, body, {
		can_link: !is_limited(trust),
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
	if (is_limited(trust)) {
		if (drafts.some((draft) => draft.media.some((media) => media.kind === 'video')))
			refuse(403, 'video_new_account')
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
	return { risky }
}

/** Links in edited text pass the same checks as new ones; an edit can't sneak one in. */
export async function check_edited_post(db: Db, user_id: string, trust: Trust, body: string) {
	return links_checked(db, user_id, body, trust)
}

/** A message's links pass the same checks as a post's. Only the host names are looked at. */
export async function check_message(db: Db, user_id: string, trust: Trust, body: string) {
	return links_checked(db, user_id, body, trust)
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
