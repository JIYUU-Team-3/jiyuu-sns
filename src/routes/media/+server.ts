import { error, json } from '@sveltejs/kit'
import { env } from 'cloudflare:workers'
import { POST_UPLOAD_MAX_BYTES, read_image, sniff_post_upload } from '#lib/media'
import { read_form } from '#lib/server/form'
import { BlockedMediaError, put_file, put_image, put_video } from '#lib/server/media'
import { is_blocked_media } from '#lib/server/moderation/media'
import { find_profile } from '#lib/server/profiles'
import { limit } from '#lib/server/rate-limit'
import { MetadataError } from '#lib/server/strip-metadata'
import { strip_video } from '#lib/server/strip-video'
import { VIDEO_MAX_SECONDS } from '#lib/posts/rules'
import type { RequestHandler } from './$types'

/**
 * An attachment for a post, uploaded as soon as it's picked so publishing only sends URLs.
 * Returns the `/media/posts/<user>/…` URL that `create_post` accepts from this user.
 */
export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) error(401, 'Sign in to continue.')
	await limit('UPLOAD_LIMIT', locals.user.id)
	if (!(await find_profile(locals.db, locals.user.id)))
		error(403, 'Finish setting up your profile.')
	// The biggest thing this takes is a video; anything larger is refused before it's read.
	const form = await read_form(request, POST_UPLOAD_MAX_BYTES.video)
	const file = form.get('file')
	if (!(file instanceof File)) error(400, 'No file.')
	// The bytes decide the kind, and the kind decides the size limit.
	const kind = await sniff_post_upload(file)
	if (file.size > POST_UPLOAD_MAX_BYTES[kind]) error(413, 'size')
	if (kind === 'file') {
		const url = await put_file(env.MEDIA, 'posts', locals.user.id, file)
		return json({ url }, { status: 201 })
	}

	try {
		const url =
			kind === 'video'
				? await store_video(locals.user.id, file)
				: await put_image(env.MEDIA, locals.user.id, await read_image(file, 'post'), (bytes) =>
						is_blocked_media(locals.db, bytes),
					)
		return json({ url }, { status: 201 })
	} catch (cause) {
		// A file whose metadata can't be stripped is refused rather than stored with it.
		if (cause instanceof MetadataError) error(415, 'type')
		if (cause instanceof BlockedMediaError) error(422, 'blocked')
		throw cause
	}
}

/** Strip a video's metadata and store it, refusing one over the length limit. */
async function store_video(user_id: string, file: File) {
	const { video, seconds } = await strip_video(file)
	// A second of slack for rounding between the browser's count and the file's.
	if (seconds > VIDEO_MAX_SECONDS + 1) error(413, 'duration')
	return put_video(env.MEDIA, user_id, video)
}
