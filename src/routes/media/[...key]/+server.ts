import { error } from '@sveltejs/kit'
import { env } from 'cloudflare:workers'
import { is_media_key } from '#lib/server/media'
import type { RequestHandler } from './$types'

/** Uploaded avatars and banners. Like profiles and posts, they're for signed-in people only. */
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
