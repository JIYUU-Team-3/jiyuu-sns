import { goto } from '$app/navigation'

/**
 * Leaves the edit page for the saved profile without leaving the edit page in history,
 * so the bar's back arrow skips it.
 *
 * Opened from your own profile: steps back onto that entry, then swaps in the saved profile
 * (its handle may have changed). Opened from anywhere else: the saved profile replaces the edit page.
 */
export function leave_after_save(target: string, from_own_profile: boolean) {
	if (!from_own_profile) return show_saved(target)
	addEventListener('popstate', () => show_saved(target), { once: true })
	history.back()
}

/** Replaces the current entry with the saved profile, reloading what shows the old one. */
const show_saved = (target: string) => goto(target, { replaceState: true, invalidateAll: true })
