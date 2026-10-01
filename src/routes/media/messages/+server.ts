import { error, json } from '@sveltejs/kit'
import { env } from 'cloudflare:workers'
import { read_image } from '#lib/media'
import { MESSAGE_FILE_MAX_BYTES, message_file_kind } from '#lib/messages/files'
import { put_image, put_message_file } from '#lib/server/media'
import { MetadataError } from '#lib/server/strip-metadata'
import type { RequestHandler } from './$types'

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) error(401, 'Sign in to continue.')
	const file = (await request.formData()).get('file')
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
