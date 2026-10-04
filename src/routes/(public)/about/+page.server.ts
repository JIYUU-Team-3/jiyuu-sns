import { profile_cards } from '#lib/server/profiles'
import type { PageServerLoad } from './$types'
import { TEAM } from './team'

/**
 * The about page is public, so visitors who aren't signed in get the team as `team.ts` has it.
 * Signed-in ones, who could open these profiles anyway, get each member's current name and photo.
 * A suspended account can still open this page, but not profiles, so it gets the snapshot too.
 */
export const load: PageServerLoad = async ({ locals }) => {
	const signed_in = !!locals.user && !locals.standing?.suspension
	if (!signed_in) return { signed_in, live: [] }
	const live = await profile_cards(
		locals.db,
		TEAM.map((member) => member.jiyuu),
	)
	return { signed_in, live }
}
