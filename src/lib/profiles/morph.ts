import { onNavigate } from '$app/navigation'
import { reduced_motion } from '#lib/settings/motion'

const PROFILE = '/(app)/u/[handle]'
const EDIT = '/(app)/settings/profile'

/** Whether a navigation goes between a profile and the edit page, either way. */
function between_profile_and_edit(from?: string | null, to?: string | null) {
	return (from === PROFILE && to === EDIT) || (from === EDIT && to === PROFILE)
}

/**
 * Morph the banner and avatar between a profile and the edit page with a view transition. Both
 * pages name those elements `profile-banner` and `profile-avatar`; other navigations are left alone.
 */
export function morph_profile_edit() {
	onNavigate((navigation) => {
		if (!document.startViewTransition) return
		if (reduced_motion()) return
		if (!between_profile_and_edit(navigation.from?.route.id, navigation.to?.route.id)) return

		// Tells the CSS which way the avatar's gap from the banner grows or shrinks.
		const root = document.documentElement
		root.dataset.morph = navigation.to?.route.id === EDIT ? 'to-edit' : 'to-profile'

		return new Promise((resolve) => {
			const transition = document.startViewTransition(async () => {
				resolve()
				await navigation.complete
			})
			const clear = () => delete root.dataset.morph
			void transition.finished.then(clear, clear)
		})
	})
}
