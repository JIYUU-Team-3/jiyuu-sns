import { redirect } from '@sveltejs/kit'
import { env } from 'cloudflare:workers'
import { localizeHref } from '#lib/paraglide/runtime'
import { profile_href } from '#lib/profiles/links'
import { read_form } from '#lib/server/form'
import { PROFILE_FORM_MAX_BYTES, submit_profile } from '#lib/server/profile-form'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ parent }) => {
	// The layout sends anyone signed out or without a profile elsewhere, and already has the profile.
	const { me, own } = await parent()
	return { draft: { name: me.name, handle: me.handle, bio: own.bio, details: own.details } }
}

export const actions: Actions = {
	// Actions skip layout loads, so this one checks the session itself.
	default: async ({ locals, request }) => {
		if (!locals.user) return redirect(302, localizeHref('/login'))

		const result = await submit_profile(
			locals.db,
			env.MEDIA,
			locals.user.id,
			await read_form(request, PROFILE_FORM_MAX_BYTES),
			locals.standing?.role === 'moderator',
		)
		if (!('saved' in result)) return result
		return redirect(303, profile_href(result.saved.handle))
	},
}
