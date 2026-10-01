import { fail } from '@sveltejs/kit'
import { IMAGE_MAX_BYTES, picked_file } from '#lib/media'
import {
	image_errors,
	profile_errors,
	read_profile,
	type ProfileErrors,
} from '#lib/profiles/form/profile'
import type { getDb } from './db'
import { save_profile_with_images } from './profile-images'
import { find_profile } from './profiles'

type Db = ReturnType<typeof getDb>

/** The most a profile form can carry: one avatar and one banner. */
export const PROFILE_FORM_MAX_BYTES = IMAGE_MAX_BYTES.avatar + IMAGE_MAX_BYTES.banner

/**
 * Check and save a submitted profile form, from onboarding or the edit page. Returns the saved
 * draft as `{ saved }`, or a `fail` carrying the draft and its field errors for the form to show.
 * `locked` keeps a moderator's handle as it is.
 */
export async function submit_profile(
	db: Db,
	bucket: R2Bucket,
	user_id: string,
	data: FormData,
	locked = false,
) {
	const draft = read_profile(data)
	// The handle the account holds now, which it may keep even if it's reserved.
	const current = (await find_profile(db, user_id))?.handle
	const images = {
		avatar: picked_file(data.get('avatar')),
		banner: picked_file(data.get('banner')),
	}
	// Files stay out of `fail` data: they can't be serialized, and the inputs keep them anyway.
	const errors = {
		...profile_errors(draft, current, locked),
		...(await image_errors(images)),
	}
	if (Object.keys(errors).length) return fail(400, { draft, errors })

	const removals = {
		avatar: data.get('avatar_remove') === '1',
		banner: data.get('banner_remove') === '1',
	}
	const saved = await save_profile_with_images(db, bucket, user_id, draft, images, removals)
	if (saved === 'taken') {
		const taken: ProfileErrors = { handle: 'taken' }
		return fail(400, { draft, errors: taken })
	}
	return { saved: draft }
}
