import { redirect } from '@sveltejs/kit'
import { env } from 'cloudflare:workers'
import { localizeHref } from '#lib/paraglide/runtime'
import { suggest_handle } from '#lib/profiles/form/profile'
import { account_image } from '#lib/server/account-image'
import { read_form } from '#lib/server/form'
import { PROFILE_FORM_MAX_BYTES, submit_profile } from '#lib/server/profile-form'
import { home_href } from '../links'
import { safe_next } from '../login/next'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = ({ locals }) => {
	if (!locals.user) return redirect(302, localizeHref('/login'))
	const { id, name, email, image } = locals.user
	return {
		account: { id, name, email, image: account_image(image) },
		suggested_handle: suggest_handle(name, email),
	}
}

export const actions: Actions = {
	default: async ({ locals, request, url }) => {
		if (!locals.user) return redirect(302, localizeHref('/login'))

		const result = await submit_profile(
			locals.db,
			env.MEDIA,
			locals.user.id,
			await read_form(request, PROFILE_FORM_MAX_BYTES),
		)
		if (!('saved' in result)) return result
		return redirect(303, safe_next(url.searchParams.get('next')) ?? home_href())
	},
}
