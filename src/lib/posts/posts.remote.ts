import { error } from '@sveltejs/kit'
import { env } from 'cloudflare:workers'
import * as v from 'valibot'
import { command, getRequestEvent, query } from '$app/server'
import { is_gif_url } from '#lib/server/gifs'
import { delete_media, is_own_post_upload } from '#lib/server/media'
import * as posts from '#lib/server/posts'
import { author_arg, feed_arg, replies_arg } from './args'
import {
	ALT_MAX,
	draft_problem,
	LOCATION_MAX,
	MEDIA_MAX,
	POLL_DAYS,
	POLL_MAX_OPTIONS,
	poll_options,
} from './rules'
import type { Media } from './types'

const Id = v.pipe(v.string(), v.uuid())
// Better Auth ids aren't UUIDs, so only the length is bounded.
const UserId = v.pipe(v.string(), v.minLength(1), v.maxLength(64))
const Cursor = v.optional(v.pipe(v.string(), v.maxLength(80)))
// The real limit is checked in graphemes by `post_problem`; this only bounds the payload.
const Text = v.pipe(v.string(), v.trim(), v.maxLength(4000))
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
	kind: v.picklist(['image', 'gif']),
	url: Url,
	width: Size,
	height: Size,
	alt: Alt,
})

const NewPost = v.pipe(
	v.object({
		body: Text,
		media: v.pipe(v.array(MediaInput), v.maxLength(MEDIA_MAX)),
		poll: v.optional(
			v.object({
				options: v.pipe(
					v.array(v.pipe(v.string(), v.maxLength(100))),
					v.maxLength(POLL_MAX_OPTIONS),
				),
				days: v.picklist(POLL_DAYS),
			}),
		),
		location: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(LOCATION_MAX))),
		reply_to: v.optional(Id),
	}),
	v.check((draft) => draft_problem(draft) === undefined, 'post_invalid'),
)

/** The viewer's id when signed in; reading posts doesn't need an account at this layer. */
function viewer() {
	return getRequestEvent().locals.user?.id
}

/** Every write goes through here: no session, no write. */
function author() {
	const { locals } = getRequestEvent()
	if (!locals.user) error(401, 'Sign in to continue.')
	return { db: locals.db, user_id: locals.user.id }
}

/** Photos must be the author's own uploads and GIFs must come from the picker's CDN. */
function allowed_media(media: Media, user_id: string) {
	return media.kind === 'image' ? is_own_post_upload(media.url, user_id) : is_gif_url(media.url)
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

export const get_author_posts = query(
	v.object({ id: UserId, tab: v.picklist(['posts', 'replies']), cursor: Cursor }),
	({ id, tab, cursor }) =>
		posts.author_page(getRequestEvent().locals.db, viewer(), id, tab === 'replies', cursor),
)

export const create_post = command(NewPost, async ({ reply_to, poll, location, ...rest }) => {
	const { db, user_id } = author()
	if (!rest.media.every((media) => allowed_media(media, user_id))) error(400, 'Invalid media.')
	const input = {
		...rest,
		location: location || undefined,
		poll: poll && { ...poll, options: poll_options(poll.options) },
	}
	const id = await posts.insert_post(db, user_id, input, reply_to)
	if (!id) error(404, 'The post you replied to was deleted.')

	// Single-flight: the fresh first pages ride back with this response.
	await Promise.all([
		get_feed(feed_arg('for_you')).refresh(),
		get_feed(feed_arg('following')).refresh(),
		get_author_posts(author_arg(user_id, reply_to ? 'replies' : 'posts')).refresh(),
		...(reply_to
			? [get_replies(replies_arg(reply_to)).refresh(), get_post(reply_to).refresh()]
			: []),
	])
	const post = await posts.find_post(db, user_id, id)
	if (!post) error(404, 'Post not found.')
	return post
})

/**
 * Edit the text and, with `media`, drop, reorder, or describe the post's photos and GIFs (the
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
		const { db, user_id } = author()
		const result = await posts.update_post(db, user_id, id, body, media)
		if (result === 'not_found') error(404, 'Post not found.')
		if (result === 'invalid') error(400, 'post_invalid')
		await delete_media(env.MEDIA, result.removed_photos)
		await get_post(id).refresh()
	},
)

export const delete_post = command(Id, async (id) => {
	const { db, user_id } = author()
	const removed = await posts.remove_post(db, user_id, id)
	if (!removed) error(404, 'Post not found.')
	await delete_media(env.MEDIA, removed.photos)
	if (removed.reply_to_id) await get_post(removed.reply_to_id).refresh()
})

export const set_like = command(v.object({ id: Id, on: v.boolean() }), async ({ id, on }) => {
	const { db, user_id } = author()
	await posts.set_like(db, user_id, id, on)
})

/** Vote in a poll; returns the poll as it now stands, the viewer's counted vote included. */
export const vote_poll = command(
	v.object({ id: Id, option: v.pipe(v.number(), v.integer(), v.minValue(0)) }),
	async ({ id, option }) => {
		const { db, user_id } = author()
		await posts.vote(db, user_id, id, option)
		const found = await posts.find_post(db, user_id, id)
		if (!found?.poll) error(404, 'Post not found.')
		return found.poll
	},
)
