import { error, json } from '@sveltejs/kit'
import { read_form } from '#lib/server/form'
import { is_own_post_upload, is_video_url } from '#lib/server/media'
import { check_deps } from '#lib/server/moderation/after-write'
import { check_upload } from '#lib/server/moderation/checks'
import { find_profile } from '#lib/server/profiles'
import { limit } from '#lib/server/rate-limit'
import type { RequestHandler } from './$types'

/**
 * Whether a photo the composer just uploaded will be shown behind the sensitive cover, so its
 * author hears before publishing. Only the answer goes back, not the scores behind it.
 */
export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) error(401, 'Sign in to continue.')
	await limit('MEDIA_CHECK_LIMIT', locals.user.id)
	if (!(await find_profile(locals.db, locals.user.id)))
		error(403, 'Finish setting up your profile.')
	const url = (await read_form(request, 4096)).get('url')
	if (typeof url !== 'string' || !is_own_post_upload(url, locals.user.id) || is_video_url(url))
		error(400, 'Invalid media.')
	const sensitive = await check_upload(locals.db, check_deps(), locals.user.id, url)
	return json({ sensitive })
}
