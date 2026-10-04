import { redirect } from '@sveltejs/kit'
import type { Author } from '#lib/posts/types'
import { account_image } from '#lib/server/account-image'
import { find_profile } from '#lib/server/profiles'
import { translation_enabled } from '#lib/server/translate'
import { login_href, onboarding_href, return_path } from '../(public)/links'
import { with_next } from '../(public)/login/next'
import type { LayoutServerLoad } from './$types'

/** The signed-in app needs an account with a handle; anyone else is sent to finish that first. */
export const load: LayoutServerLoad = async ({ locals, url }) => {
	if (!locals.user) return redirect(302, login_href(url))

	const profile = await find_profile(locals.db, locals.user.id)
	if (!profile) return redirect(302, with_next(onboarding_href(), return_path(url)))

	const me: Author & { handle: string } = {
		id: locals.user.id,
		name: profile.displayName,
		handle: profile.handle,
		image: profile.avatarUrl ?? account_image(locals.user.image),
	}
	// The rest of the account's profile, for the edit page, so it needn't query it again.
	const own = {
		bio: profile.bio,
		banner: profile.bannerUrl ?? undefined,
		avatar_uploaded: !!profile.avatarUrl,
		account_image: account_image(locals.user.image),
		details: {
			location: profile.location,
			birth_date: profile.birthDate,
			birthday_audience: profile.birthdayAudience,
			birth_year_audience: profile.birthYearAudience,
		},
	}
	return {
		me,
		own,
		moderator: locals.standing?.role === 'moderator',
		/** Whether "Translate post" can work: DeepL or Workers AI is set up. */
		translate: translation_enabled(),
	}
}
