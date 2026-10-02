import { error, json } from '@sveltejs/kit'
import { env } from 'cloudflare:workers'
import { IMAGE_MAX_BYTES, image_problem, picked_file, read_image } from '#lib/media'
import { read_form } from '#lib/server/form'
import { BlockedMediaError, put_image } from '#lib/server/media'
import { is_blocked_media } from '#lib/server/moderation/media'
import { find_profile } from '#lib/server/profiles'
import { limit } from '#lib/server/rate-limit'
import { MetadataError } from '#lib/server/strip-metadata'
import type { RequestHandler } from './$types'

/**
 * A photo for a message, uploaded as soon as it's picked. Returns the `/media/messages/<user>/…`
 * URL that `send_message` accepts from this user; until it's sent, only they can open it.
 */
export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) error(401, 'Sign in to continue.')
	await limit('UPLOAD_LIMIT', locals.user.id)
	if (!(await find_profile(locals.db, locals.user.id)))
		error(403, 'Finish setting up your profile.')
	const form = await read_form(request, IMAGE_MAX_BYTES.message)
	const file = picked_file(form.get('file'))
	if (!file) error(400, 'No file.')
	const problem = await image_problem(file, 'message')
	if (problem === 'type') error(415, 'type')
	if (problem === 'size') error(413, 'size')

	try {
		const url = await put_image(
			env.MEDIA,
			locals.user.id,
			await read_image(file, 'message'),
			(bytes) => is_blocked_media(locals.db, bytes),
		)
		return json({ url }, { status: 201 })
	} catch (cause) {
		if (cause instanceof MetadataError) error(415, 'type')
		if (cause instanceof BlockedMediaError) error(422, 'blocked')
		throw cause
	}
}
