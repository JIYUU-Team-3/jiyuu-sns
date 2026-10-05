import { error } from '@sveltejs/kit'
import * as v from 'valibot'
import { command, query } from '$app/server'
import { follows_arg } from '#lib/posts/args'
import {
	list_follows,
	remove_follower as drop_follower,
	set_follow as save_follow,
	set_post_alerts as save_post_alerts,
} from '#lib/server/follows'
import { find_profile, find_profile_by_handle } from '#lib/server/profiles'
import {
	follows_last_hour,
	is_limited,
	LIMITED_FOLLOWS_PER_HOUR,
	trust_level,
} from '#lib/server/moderation/trust'
import { limit } from '#lib/server/rate-limit'
import { member, signed_in } from '#lib/server/session'

const Handle = v.pipe(v.string(), v.regex(/^[a-z0-9_.]{3,20}$/))
const UserId = v.pipe(v.string(), v.minLength(1), v.maxLength(64))
const Cursor = v.optional(v.pipe(v.string(), v.maxLength(160)))

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

/** Hear about each new post from an account the viewer follows, or stop. */
export const set_post_alerts = command(
	v.object({ handle: Handle, on: v.boolean() }),
	async ({ handle, on }) => {
		const { db, user_id } = await member()
		await limit('WRITE_LIMIT', user_id)
		if (!(await save_post_alerts(db, user_id, handle, on))) error(404, 'Not following.')
		await get_profile(handle).refresh()
	},
)

/** Who an account follows, or who follows it, at a pace scrolling reaches and a scraper doesn't. */
export const get_follows = query(
	v.object({ id: UserId, side: v.picklist(['following', 'followers']), cursor: Cursor }),
	async ({ id, side, cursor }) => {
		const { db, user_id } = signed_in()
		await limit('LOOKUP_LIMIT', user_id)
		return list_follows(db, user_id, id, side, cursor)
	},
)

export const remove_follower = command(v.object({ handle: Handle }), async ({ handle }) => {
	const { db, user_id } = await member()
	if (!(await drop_follower(db, user_id, handle))) return
	// Your follower count and theirs both move, and the list it was removed from.
	const mine = await find_profile(db, user_id)
	await Promise.all([
		get_follows(follows_arg(user_id, 'followers')).refresh(),
		get_profile(handle).refresh(),
		mine && get_profile(mine.handle).refresh(),
	])
})
