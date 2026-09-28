import { fail, redirect } from '@sveltejs/kit'
import { localizeHref } from '#lib/paraglide/runtime'
import { profile_href } from '#lib/profiles/links'
import { find_profile, save_profile } from '#lib/server/profiles'
import { onboarding_href } from '../../../(public)/links'
import {
	profile_errors,
	read_profile,
	type ProfileErrors,
} from '../../../(public)/onboarding/profile'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
	// Page loads run alongside the layout's, so they can't lean on its redirects.
	const user = locals.user
	if (!user) return redirect(302, localizeHref('/login'))
	const profile = await find_profile(locals.db, user.id)
	if (!profile) return redirect(302, onboarding_href())
	return {
		profile: {
			id: user.id,
			name: profile.displayName,
			handle: profile.handle,
			bio: profile.bio,
			image: profile.avatarUrl ?? user.image ?? undefined,
			header: profile.headerUrl ?? undefined,
		},
	}
}

export const actions: Actions = {
	default: async ({ locals, request }) => {
		// Actions skip layout loads, so the session is checked again here.
		if (!locals.user) return redirect(302, localizeHref('/login'))

		const draft = read_profile(await request.formData())
		const errors = profile_errors(draft)
		if (Object.keys(errors).length) return fail(400, { draft, errors })

		const saved = await save_profile(locals.db, locals.user.id, draft)
		if (saved === 'taken') {
			const taken: ProfileErrors = { handle: 'taken' }
			return fail(400, { draft, errors: taken })
		}

		return redirect(303, profile_href(draft.handle))
	},
}
