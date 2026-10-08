import { error, json } from '@sveltejs/kit'
import * as v from 'valibot'
import { PostText } from '#lib/posts/input'
import { draft_problem } from '#lib/posts/rules'
import { REPLY_AUDIENCES } from '#lib/safety/rules'
import { api_member } from '#lib/server/api-tokens'
import { read_json } from '#lib/server/form'
import { publish_posts } from '#lib/server/publish'
import { limit } from '#lib/server/rate-limit'
import type { RequestHandler } from './$types'

/** Twice the longest text the schema takes, with room for the other fields. */
const BODY_MAX = 16 * 1024

/** A text post, the one thing a key can make. No photos: uploads need a signed-in session. */
const ApiPost = v.object({
	text: PostText,
	reply_audience: v.optional(v.picklist(REPLY_AUDIENCES), 'everyone'),
	/** False to leave the first link's card off. */
	link_preview: v.optional(v.boolean()),
})

/** Post as the key's owner, past the same checks and limits as the composer. See docs/API.md. */
export const POST: RequestHandler = async (event) => {
	const { db, user_id } = await api_member(event)
	await limit('WRITE_LIMIT', user_id)
	const input = v.safeParse(ApiPost, await read_json(event.request, BODY_MAX))
	if (!input.success) error(400, 'post_invalid')
	const { text, reply_audience, link_preview } = input.output
	const draft = { body: text, media: [], link_preview }
	if (draft_problem(draft)) error(400, 'post_invalid')
	const [id] = await publish_posts(db, user_id, [draft], undefined, reply_audience)
	return json({ id, url: new URL(`/p/${id}`, event.url).href }, { status: 201 })
}
