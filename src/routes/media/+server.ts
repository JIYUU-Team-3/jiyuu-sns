import { error, json } from '@sveltejs/kit'
import { env } from 'cloudflare:workers'
import { picked_file, POST_UPLOAD_MAX_BYTES, read_image, sniff_post_upload } from '#lib/media'
import { read_form } from '#lib/server/form'
import { put_image, put_video } from '#lib/server/media'
import { find_profile } from '#lib/server/profiles'
import { limit } from '#lib/server/rate-limit'
import { MetadataError } from '#lib/server/strip-metadata'
import { strip_video } from '#lib/server/strip-video'
import { VIDEO_MAX_SECONDS } from '#lib/posts/rules'
import type { RequestHandler } from './$types'

/**
 * A photo or video for a post, uploaded as soon as it's picked so publishing only sends URLs.
 * Returns the `/media/posts/<user>/…` URL that `create_post` accepts from this user.
 */
export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) error(401, 'Sign in to continue.')
	await limit('UPLOAD_LIMIT', locals.user.id)
	if (!(await find_profile(locals.db, locals.user.id)))
		error(403, 'Finish setting up your profile.')
	// The biggest thing this takes is a video; anything larger is refused before it's read.
	const form = await read_form(request, POST_UPLOAD_MAX_BYTES.video)
	const file = picked_file(form.get('file'))
	if (!file) error(400, 'No file.')
	// The bytes decide the kind, and the kind decides the size limit.
	const kind = (await sniff_post_upload(file)) ?? error(415, 'type')
	if (file.size > POST_UPLOAD_MAX_BYTES[kind]) error(413, 'size')

	try {
		const url =
			kind === 'video'
				? await store_video(locals.user.id, file)
				: await put_image(env.MEDIA, locals.user.id, await read_image(file, 'post'))
		return json({ url }, { status: 201 })
	} catch (cause) {
		// A file whose metadata can't be stripped is refused rather than stored with it.
		if (cause instanceof MetadataError) error(415, 'type')
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
