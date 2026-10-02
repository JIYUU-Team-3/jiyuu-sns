import { error, json } from '@sveltejs/kit'
import { env } from 'cloudflare:workers'
import { read_image } from '#lib/media'
import { MESSAGE_FILE_MAX_BYTES, message_file_kind } from '#lib/messages/files'
import { put_image, put_message_file } from '#lib/server/media'
import { read_form } from '#lib/server/form'
import { find_profile } from '#lib/server/profiles'
import { limit } from '#lib/server/rate-limit'
import { MetadataError } from '#lib/server/strip-metadata'
import type { RequestHandler } from './$types'

/**
 * A file for a message, uploaded as soon as it's picked. Returns the `/media/messages/<user>/…`
 * URL that `send_message` accepts from this user; until it's sent, only they can open it.
 */
export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) error(401, 'Sign in to continue.')
	await limit('UPLOAD_LIMIT', locals.user.id)
	if (!(await find_profile(locals.db, locals.user.id)))
		error(403, 'Finish setting up your profile.')
	const file = (await read_form(request, MESSAGE_FILE_MAX_BYTES)).get('file')
	if (!(file instanceof File)) error(400, 'No file.')
	if (file.size > MESSAGE_FILE_MAX_BYTES) error(413, 'size')
	if ((await message_file_kind(file)) === 'file') {
		const url = await put_message_file(env.MEDIA, locals.user.id, file)
		return json({ url }, { status: 201 })
	}

	try {
		const url = await put_image(env.MEDIA, locals.user.id, await read_image(file, 'message'))
		return json({ url }, { status: 201 })
	} catch (cause) {
		if (cause instanceof MetadataError) error(415, 'type')
		throw cause
	}
}
