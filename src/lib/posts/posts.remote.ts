import { error } from '@sveltejs/kit'
import { env } from 'cloudflare:workers'
import * as v from 'valibot'
import { command, getRequestEvent, query } from '$app/server'
import { is_gif_url } from '#lib/server/gifs'
import { delete_media, is_own_post_upload, is_video_url } from '#lib/server/media'
import * as posts from '#lib/server/posts'
import { check_posts_later } from '#lib/server/moderation/after-write'
import { check_edited_post, check_new_posts, flag_risky_links } from '#lib/server/moderation/write'
import { trust_level } from '#lib/server/moderation/trust'
import { member, signed_in } from '#lib/server/session'
import { clean_text } from './clean'
import { author_arg, feed_arg, replies_arg } from './args'
import {
	ALT_MAX,
	draft_problem,
	LOCATION_MAX,
	MEDIA_MAX,
	POLL_DAYS,
	POLL_MAX_OPTIONS,
	poll_options,
	THREAD_MAX,
} from './rules'
import type { Media } from './types'

const Id = v.pipe(v.string(), v.uuid())
// Better Auth ids aren't UUIDs, so only the length is bounded.
const UserId = v.pipe(v.string(), v.minLength(1), v.maxLength(64))
const Cursor = v.optional(v.pipe(v.string(), v.maxLength(80)))
// The real limit is checked in graphemes by `post_problem`; this only bounds the payload. Bidi
// overrides and stacked marks are taken out first, as names and bios already are.
const Text = v.pipe(
	v.string(),
	v.maxLength(8000),
	v.transform(clean_text),
	v.trim(),
	v.maxLength(4000),
)
const Size = v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(20_000))
const Url = v.pipe(v.string(), v.maxLength(2048))
// A blank description is no description.
const Alt = v.pipe(
	v.optional(v.string(), ''),
	v.trim(),
	v.maxLength(ALT_MAX),
	v.transform((alt) => alt || undefined),
)

const MediaInput = v.object({
	kind: v.picklist(['image', 'gif', 'video']),
	url: Url,
	width: Size,
	height: Size,
	alt: Alt,
})

const PostFields = {
	body: Text,
	media: v.pipe(v.array(MediaInput), v.maxLength(MEDIA_MAX)),
	poll: v.optional(
		v.object({
			options: v.pipe(v.array(v.pipe(v.string(), v.maxLength(100))), v.maxLength(POLL_MAX_OPTIONS)),
			days: v.picklist(POLL_DAYS),
		}),
	),
	location: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(LOCATION_MAX))),
	sensitive: v.optional(v.boolean()),
}

const PostInput = v.pipe(
	v.object(PostFields),
	v.check((draft) => draft_problem(draft) === undefined, 'post_invalid'),
)

const NewPost = v.pipe(
	v.object({ ...PostFields, reply_to: v.optional(Id) }),
	v.check((draft) => draft_problem(draft) === undefined, 'post_invalid'),
)

const NewThread = v.object({
	posts: v.pipe(v.array(PostInput), v.minLength(2), v.maxLength(THREAD_MAX)),
	reply_to: v.optional(Id),
})

/** Posts are for signed-in people only, so reading them needs a session too. */
const viewer = () => signed_in().user_id

/** Every write goes through here: no session or no profile, no write. */
const author = member

/**
 * Photos and videos must be the author's own uploads, of the kind they claim to be; GIFs must
 * come from the picker's CDN.
 */
function allowed_media({ kind, url }: Media, user_id: string) {
	if (kind === 'gif') return is_gif_url(url)
	return is_own_post_upload(url, user_id) && is_video_url(url) === (kind === 'video')
}

export const get_feed = query(
	v.object({ tab: v.picklist(['for_you', 'following']), cursor: Cursor }),
	({ tab, cursor }) => posts.feed_page(getRequestEvent().locals.db, viewer(), tab, cursor),
)

export const get_post = query(Id, async (id) => {
	const found = await posts.find_post(getRequestEvent().locals.db, viewer(), id)
	if (!found) error(404, 'Post not found.')
	return found
})

export const get_replies = query(v.object({ id: Id, cursor: Cursor }), ({ id, cursor }) =>
	posts.replies_page(getRequestEvent().locals.db, viewer(), id, cursor),
)

export const get_conversation = query(Id, (id) =>
	posts.conversation(getRequestEvent().locals.db, viewer(), id),
)

export const get_author_posts = query(
	v.object({ id: UserId, tab: v.picklist(['posts', 'replies']), cursor: Cursor }),
	({ id, tab, cursor }) =>
		posts.author_page(getRequestEvent().locals.db, viewer(), id, tab === 'replies', cursor),
)

type PostPayload = v.InferOutput<typeof PostInput>

function prepare({ poll, location, ...rest }: PostPayload, user_id: string) {
	if (!rest.media.every((media) => allowed_media(media, user_id))) error(400, 'Invalid media.')
	return {
		...rest,
		location: location || undefined,
		poll: poll && { ...poll, options: poll_options(poll.options) },
	}
}

async function publish(inputs: PostPayload[], reply_to: string | undefined) {
	const { db, user_id } = await author()
	const prepared = inputs.map((input) => prepare(input, user_id))
	const trust = await trust_level(db, user_id)
	const { risky } = await check_new_posts(db, user_id, trust, prepared)
	const ids = await posts.insert_thread(db, user_id, prepared, reply_to)
	if (!ids) error(404, 'The post you replied to was deleted.')
	await flag_risky_links(db, user_id, ids, risky)
	check_posts_later(db, ids)

	// Single-flight: the fresh first pages ride back with this response.
	await Promise.all([
		get_feed(feed_arg('for_you')).refresh(),
		get_feed(feed_arg('following')).refresh(),
		get_author_posts(author_arg(user_id, 'posts')).refresh(),
		get_author_posts(author_arg(user_id, 'replies')).refresh(),
		...(reply_to
			? [
					get_replies(replies_arg(reply_to)).refresh(),
					get_post(reply_to).refresh(),
					get_conversation(reply_to).refresh(),
				]
			: []),
	])
	const post = await posts.find_post(db, user_id, ids[0])
	if (!post) error(404, 'Post not found.')
	return post
}

export const create_post = command(NewPost, ({ reply_to, ...input }) => publish([input], reply_to))

export const create_thread = command(NewThread, ({ posts: inputs, reply_to }) =>
	publish(inputs, reply_to),
)

/**
 * Edit the text and, with `media`, drop, reorder, or describe the post's photos, GIFs and videos (the
 * URLs to keep, in order, each with its description). Text may go empty only while photos
 * remain; that's checked against the stored post.
 */
export const edit_post = command(
	v.object({
		id: Id,
		body: Text,
		media: v.optional(v.pipe(v.array(v.object({ url: Url, alt: Alt })), v.maxLength(MEDIA_MAX))),
	}),
	async ({ id, body, media }) => {
		const { db, user_id } = await author()
		await check_edited_post(db, user_id, await trust_level(db, user_id), body)
		const result = await posts.update_post(db, user_id, id, body, media)
		if (result === 'not_found') error(404, 'Post not found.')
		if (result === 'invalid') error(400, 'post_invalid')
		if (result === 'locked') error(409, 'poll_locked')
		// New text gets the same checks as a new post.
		check_posts_later(db, [id])
		await delete_unused_uploads(db, result.removed_uploads)
		await get_post(id).refresh()
	},
)

export const delete_post = command(Id, async (id) => {
	const { db, user_id } = await author()
	const removed = await posts.remove_post(db, user_id, id)
	if (!removed) error(404, 'Post not found.')
	await delete_unused_uploads(db, removed.uploads)
	if (removed.reply_to_id) {
		await Promise.all([
			get_post(removed.reply_to_id).refresh(),
			get_conversation(removed.reply_to_id).refresh(),
		])
	}
})

/** Delete the files behind `urls` that no other post still shows. */
async function delete_unused_uploads(db: App.Locals['db'], urls: string[]) {
	await delete_media(env.MEDIA, await posts.unused_uploads(db, urls))
}

export const set_like = command(v.object({ id: Id, on: v.boolean() }), async ({ id, on }) => {
	const { db, user_id } = await author()
	await posts.set_like(db, user_id, id, on)
})

/** Vote in a poll; returns the poll as it now stands, the viewer's counted vote included. */
export const vote_poll = command(
	v.object({ id: Id, option: v.pipe(v.number(), v.integer(), v.minValue(0)) }),
	async ({ id, option }) => {
		const { db, user_id } = await author()
		await posts.vote(db, user_id, id, option)
		const found = await posts.find_post(db, user_id, id)
		if (!found?.poll) error(404, 'Post not found.')
		return found.poll
	},
)
