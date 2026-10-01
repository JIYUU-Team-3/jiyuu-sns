import { error, json } from '@sveltejs/kit'
import { env } from 'cloudflare:workers'
import { image_problem, picked_file, read_image } from '#lib/media'
import { put_image } from '#lib/server/media'
import { MetadataError } from '#lib/server/strip-metadata'
import type { RequestHandler } from './$types'

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) error(401, 'Sign in to continue.')
	const file = picked_file((await request.formData()).get('file'))
	if (!file) error(400, 'No file.')
	const problem = await image_problem(file, 'message')
	if (problem === 'type') error(415, 'type')
	if (problem === 'size') error(413, 'size')

	try {
		const url = await put_image(env.MEDIA, locals.user.id, await read_image(file, 'message'))
		return json({ url }, { status: 201 })
	} catch (cause) {
		if (cause instanceof MetadataError) error(415, 'type')
		throw cause
	}
}
