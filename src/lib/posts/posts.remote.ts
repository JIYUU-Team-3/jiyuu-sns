import { error } from '@sveltejs/kit'
import * as v from 'valibot'
import { command, form, getRequestEvent, query } from '$app/server'
import * as posts from '#lib/server/posts'
import { post_problem } from './rules'
import { feed_arg, replies_arg } from './args'

const Id = v.pipe(v.string(), v.uuid())
const Cursor = v.optional(v.pipe(v.string(), v.maxLength(80)))
const Body = v.pipe(
	v.string(),
	v.trim(),
	v.check((body) => post_problem(body) === undefined, 'post_invalid'),
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
	v.object({ id: v.pipe(v.string(), v.maxLength(64)), cursor: Cursor }),
	({ id, cursor }) => posts.author_page(getRequestEvent().locals.db, viewer(), id, cursor),
)

export const create_post = form(
	v.object({ body: Body, reply_to: v.optional(v.union([v.literal(''), Id])) }),
	async ({ body, reply_to }) => {
		const { db, user_id } = author()
		const id = await posts.insert_post(db, user_id, body, reply_to || undefined)
		if (!id) error(404, 'The post you replied to was deleted.')

		// Single-flight: the fresh first pages ride back with this response.
		await Promise.all([
			get_feed(feed_arg('for_you')).refresh(),
			get_feed(feed_arg('following')).refresh(),
			...(reply_to
				? [get_replies(replies_arg(reply_to)).refresh(), get_post(reply_to).refresh()]
				: []),
		])
		return { id }
	},
)

export const edit_post = command(v.object({ id: Id, body: Body }), async ({ id, body }) => {
	const { db, user_id } = author()
	if (!(await posts.update_post(db, user_id, id, body))) error(404, 'Post not found.')
	await get_post(id).refresh()
})

export const delete_post = command(Id, async (id) => {
	const { db, user_id } = author()
	const removed = await posts.remove_post(db, user_id, id)
	if (!removed) error(404, 'Post not found.')
	if (removed.reply_to_id) await get_post(removed.reply_to_id).refresh()
})

export const set_like = command(v.object({ id: Id, on: v.boolean() }), async ({ id, on }) => {
	const { db, user_id } = author()
	await posts.set_like(db, user_id, id, on)
})
