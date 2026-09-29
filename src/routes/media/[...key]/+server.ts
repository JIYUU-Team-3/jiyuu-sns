import { error } from '@sveltejs/kit'
import { env } from 'cloudflare:workers'
import { eq } from 'drizzle-orm'
import { postMedia } from '#lib/server/db/schema'
import { is_media_key, is_own_post_upload } from '#lib/server/media'
import type { RequestHandler } from './$types'

/** Uploaded avatars, banners and post photos. Like profiles and posts, they're for signed-in people only. */
export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) error(401, 'Sign in to continue.')
	if (!is_media_key(params.key)) error(404, 'Not found.')

	const object = await env.MEDIA.get(params.key)
	if (!object) error(404, 'Not found.')

	return new Response(object.body, {
		headers: {
			'content-type': object.httpMetadata?.contentType ?? 'application/octet-stream',
			'content-length': String(object.size),
			etag: object.httpEtag,
			// Keys are never reused, so a copy never goes stale; `private` because this needs a session.
			'cache-control': 'private, max-age=31536000, immutable',
			'x-content-type-options': 'nosniff',
		},
	})
}

/**
 * Drop a photo the composer uploaded and then took off the draft. Only the uploader can, and
 * only while no post uses it; a published post's photos go when the post is deleted.
 */
export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) error(401, 'Sign in to continue.')
	const url = `/media/${params.key}`
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
