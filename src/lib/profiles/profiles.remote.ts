import { error } from '@sveltejs/kit'
import * as v from 'valibot'
import { command, getRequestEvent, query } from '$app/server'
import { set_follow as save_follow } from '#lib/server/follows'
import { find_profile_by_handle } from '#lib/server/profiles'

const Handle = v.pipe(v.string(), v.regex(/^[a-z0-9_.]{3,20}$/))

export const get_profile = query(Handle, async (handle) => {
	const { locals } = getRequestEvent()
	const found = await find_profile_by_handle(locals.db, locals.user?.id, handle)
	if (!found) error(404, 'Profile not found.')
	return found
})

export const set_follow = command(
	v.object({ handle: Handle, on: v.boolean() }),
	async ({ handle, on }) => {
		const { locals } = getRequestEvent()
		if (!locals.user) error(401, 'Sign in to continue.')
		await save_follow(locals.db, locals.user.id, handle, on)
		await get_profile(handle).refresh()
	},
)
