import { redirect } from '@sveltejs/kit'
import { localizeHref } from '#lib/paraglide/runtime'
import type { Author } from '#lib/posts/types'
import { find_profile } from '#lib/server/profiles'
import { onboarding_href } from '../(public)/links'
import type { LayoutServerLoad } from './$types'

/** The signed-in app needs an account with a handle; anyone else is sent to finish that first. */
export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) return redirect(302, localizeHref('/login'))

	const profile = await find_profile(locals.db, locals.user.id)
	if (!profile) return redirect(302, onboarding_href())

	const me: Author & { handle: string } = {
		id: locals.user.id,
		name: profile.displayName,
		handle: profile.handle,
		image: profile.avatarUrl ?? locals.user.image ?? undefined,
	}
	// The rest of the account's profile, for the edit page, so it needn't query it again.
	const own = {
		bio: profile.bio,
		banner: profile.bannerUrl ?? undefined,
		avatar_uploaded: !!profile.avatarUrl,
		account_image: locals.user.image ?? undefined,
	}
	return { me, own }
}
