import { redirect } from '@sveltejs/kit'
import { localizeHref } from '#lib/paraglide/runtime'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = ({ locals }) => {
	if (!locals.user) return redirect(302, localizeHref('/login'))
	return {}
}
