import { error } from '@sveltejs/kit'
import { env } from 'cloudflare:workers'
import { eq } from 'drizzle-orm'
import { postMedia } from '#lib/server/db/schema'
import {
	is_media_key,
	is_message_key,
	is_own_message_upload,
	is_own_post_upload,
} from '#lib/server/media'
import { can_see_media, media_in_use } from '#lib/server/messages'
import type { RequestHandler } from './$types'

/**
 * Uploaded avatars, banners, post photos and videos. Like profiles and posts, they're for
 * signed-in people only. Byte ranges are served so videos can seek, and Safari plays them at all.
 */
export const GET: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) error(401, 'Sign in to continue.')
	if (!is_media_key(params.key)) error(404, 'Not found.')
	if (is_message_key(params.key)) {
		const url = `/media/${params.key}`
		const allowed =
			is_own_message_upload(url, locals.user.id) ||
			(await can_see_media(locals.db, locals.user.id, url))
		if (!allowed) error(404, 'Not found.')
	}

	const object = await get_object(params.key, request.headers)
	if (!object) error(404, 'Not found.')

	const range = byte_range(object)
	return new Response(object.body, {
		status: range ? 206 : 200,
		headers: {
			'content-type': object.httpMetadata?.contentType ?? 'application/octet-stream',
			'content-length': String(range ? range.end - range.start + 1 : object.size),
			...(range && { 'content-range': `bytes ${range.start}-${range.end}/${object.size}` }),
			'accept-ranges': 'bytes',
			etag: object.httpEtag,
			// Keys are never reused, so a copy never goes stale; `private` because this needs a session.
			'cache-control': 'private, max-age=31536000, immutable',
			'x-content-type-options': 'nosniff',
		},
	})
}

/** The object, or the part a `Range` header asks for; a range past the end is a 416. */
async function get_object(key: string, headers: Headers) {
	try {
		return await env.MEDIA.get(key, headers.has('range') ? { range: headers } : undefined)
	} catch {
		error(416, 'Range not satisfiable.')
	}
}

/** The first and last byte R2 returned, when only part of the object was asked for. */
function byte_range({ range, size }: R2ObjectBody) {
	if (!range) return undefined
	// Deployed R2 fills in every field, `undefined` where unused, so check values, not keys.
	const { offset, length, suffix } = range as { offset?: number; length?: number; suffix?: number }
	if (suffix !== undefined) return { start: Math.max(0, size - suffix), end: size - 1 }
	const start = offset ?? 0
	return { start, end: length === undefined ? size - 1 : start + length - 1 }
}

/**
 * Drop a photo the composer uploaded and then took off the draft. Only the uploader can, and
 * only while no post uses it; a published post's photos go when the post is deleted.
 */
export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) error(401, 'Sign in to continue.')
	const url = `/media/${params.key}`
	if (is_own_message_upload(url, locals.user.id)) {
		if (await media_in_use(locals.db, url)) error(409, 'In use.')
		await env.MEDIA.delete(params.key)
		return new Response(null, { status: 204 })
	}
	if (!is_own_post_upload(url, locals.user.id)) error(404, 'Not found.')

	const [used] = await locals.db
		.select({ id: postMedia.postId })
		.from(postMedia)
		.where(eq(postMedia.url, url))
		.limit(1)
	if (used) error(409, 'In use.')
	await env.MEDIA.delete(params.key)
	return new Response(null, { status: 204 })
}
