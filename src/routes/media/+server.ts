import { error, json } from '@sveltejs/kit'
import { env } from 'cloudflare:workers'
import { image_problem, picked_file, read_image } from '#lib/media'
import { put_image } from '#lib/server/media'
import { MetadataError } from '#lib/server/strip-metadata'
import type { RequestHandler } from './$types'

/**
 * A photo for a post, uploaded as soon as it's picked so publishing only sends URLs. Returns the
 * `/media/posts/<user>/…` URL that `create_post` accepts from this user.
 */
export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) error(401, 'Sign in to continue.')
	const file = picked_file((await request.formData()).get('file'))
	if (!file) error(400, 'No file.')
	const problem = await image_problem(file, 'post')
	if (problem) error(problem === 'size' ? 413 : 415, problem)

	try {
		const url = await put_image(env.MEDIA, locals.user.id, await read_image(file, 'post'))
		return json({ url }, { status: 201 })
	} catch (cause) {
		// A file whose metadata can't be stripped is refused rather than stored with it.
		if (cause instanceof MetadataError) error(415, 'type')
		throw cause
	}
}
