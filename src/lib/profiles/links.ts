import { localizeHref } from '#lib/paraglide/runtime'

/**
 * A Jiyuu profile in the current locale, e.g. `manut` → `/ja/u/manut`.
 * Signed-out visitors are sent to `/login` by the app layout.
 */
export const profile_href = (handle: string) => localizeHref(`/u/${encodeURIComponent(handle)}`)

/** Where you edit your own profile. */
export const edit_profile_href = () => localizeHref('/settings/profile')

/** Who `handle` follows. */
export const following_href = (handle: string) =>
	localizeHref(`/u/${encodeURIComponent(handle)}/following`)

/** Who follows `handle`. */
export const followers_href = (handle: string) =>
	localizeHref(`/u/${encodeURIComponent(handle)}/followers`)
