import { error } from '@sveltejs/kit'
import * as v from 'valibot'
import { command, query } from '$app/server'
import { set_follow as save_follow } from '#lib/server/follows'
import { find_profile_by_handle } from '#lib/server/profiles'
import {
	follows_last_hour,
	is_limited,
	LIMITED_FOLLOWS_PER_HOUR,
	trust_level,
} from '#lib/server/moderation/trust'
import { member, signed_in } from '#lib/server/session'

const Handle = v.pipe(v.string(), v.regex(/^[a-z0-9_.]{3,20}$/))

export const get_profile = query(Handle, async (handle) => {
	const { db, user_id } = signed_in()
	const found = await find_profile_by_handle(db, user_id, handle)
	if (!found) error(404, 'Profile not found.')
	return found
})

export const set_follow = command(
	v.object({ handle: Handle, on: v.boolean() }),
	async ({ handle, on }) => {
		const { db, user_id } = await member()
		// A new account follows at a pace a person keeps, so it can't follow everyone for follow-backs.
		if (
			on &&
			is_limited(await trust_level(db, user_id)) &&
			(await follows_last_hour(db, user_id)) >= LIMITED_FOLLOWS_PER_HOUR
		)
			error(429, 'follow_rate')
		await save_follow(db, user_id, handle, on)
		await get_profile(handle).refresh()
	},
)
