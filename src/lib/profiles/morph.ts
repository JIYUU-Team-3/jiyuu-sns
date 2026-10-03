import { onNavigate } from '$app/navigation'
import { reduced_motion } from '#lib/settings/motion'

const PROFILE = '/(app)/u/[handle]'
const EDIT = '/(app)/settings/profile'
/** The gap between the avatar and the banner on the profile; keep in step with `--gap` there. */
const PROFILE_GAP = 4

/** Whether a navigation goes between a profile and the edit page, either way. */
function between_profile_and_edit(from?: string | null, to?: string | null) {
	return (from === PROFILE && to === EDIT) || (from === EDIT && to === PROFILE)
}

/** The avatar's cut-out on the current page: centre as a share of the banner, radius in px. */
function gap_in_banner(gap: number) {
	const banner = document.querySelector('[data-morph="banner"]')?.getBoundingClientRect()
	// The circle itself: on the profile its wrapper carries the gap as padding.
	const holder = document.querySelector('[data-morph="avatar"]')
	const avatar = (holder?.querySelector('.av') ?? holder)?.getBoundingClientRect()
	if (!banner || !avatar || !banner.width || !banner.height) return null
	return {
		x: ((avatar.left + avatar.width / 2 - banner.left) / banner.width) * 100,
		y: ((avatar.top + avatar.height / 2 - banner.top) / banner.height) * 100,
		r: avatar.width / 2 + gap,
	}
}

/**
 * Hands the CSS where the banner's cut-out starts and ends, so it can follow the avatar while the
 * banner flies (see app.css). Transparent mode has no page colour to paint a ring in, so it cuts.
 */
function set_gap(root: HTMLElement, end: 'from' | 'to', gap: number) {
	const at = gap_in_banner(gap)
	if (!at) return
	root.style.setProperty(`--morph-${end}-x`, `${at.x}%`)
	root.style.setProperty(`--morph-${end}-y`, `${at.y}%`)
	root.style.setProperty(`--morph-${end}-r`, `${at.r}px`)
}

function clear_gap(root: HTMLElement) {
	for (const end of ['from', 'to'])
		for (const axis of ['x', 'y', 'r']) root.style.removeProperty(`--morph-${end}-${axis}`)
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
		const to_edit = navigation.to?.route.id === EDIT
		root.dataset.morph = to_edit ? 'to-edit' : 'to-profile'
		set_gap(root, 'from', to_edit ? PROFILE_GAP : 0)

		return new Promise((resolve) => {
			const transition = document.startViewTransition(async () => {
				resolve()
				await navigation.complete
				set_gap(root, 'to', to_edit ? 0 : PROFILE_GAP)
			})
			const clear = () => {
				delete root.dataset.morph
				clear_gap(root)
			}
			void transition.finished.then(clear, clear)
		})
	})
}
