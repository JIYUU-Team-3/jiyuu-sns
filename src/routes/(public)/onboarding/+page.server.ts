import { fail, redirect } from '@sveltejs/kit'
import { localizeHref } from '#lib/paraglide/runtime'
import { save_profile } from '#lib/server/profiles'
import { home_href } from '../links'
import { profile_errors, read_profile, suggest_handle, type ProfileErrors } from './profile'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = ({ locals }) => {
	if (!locals.user) return redirect(302, localizeHref('/login'))
	const { name, email, image } = locals.user
	return {
		account: { name, email, image: image ?? undefined },
		suggested_handle: suggest_handle(name, email),
	}
}

export const actions: Actions = {
	default: async ({ locals, request }) => {
		if (!locals.user) return redirect(302, localizeHref('/login'))

		const draft = read_profile(await request.formData())
		const errors = profile_errors(draft)
		if (Object.keys(errors).length) return fail(400, { draft, errors })

		const saved = await save_profile(locals.db, locals.user.id, draft)
		if (saved === 'taken') {
			const taken: ProfileErrors = { handle: 'taken' }
			return fail(400, { draft, errors: taken })
		}

		return redirect(303, home_href())
	},
}
