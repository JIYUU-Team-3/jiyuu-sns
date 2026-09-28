import { localizeHref } from '#lib/paraglide/runtime'

/**
 * A Jiyuu profile in the current locale, e.g. `manut` → `/ja/profile/manut`.
 * Signed-out visitors are sent to `/login` by the app layout.
 */
export const profile_href = (handle: string) =>
	localizeHref(`/profile/${encodeURIComponent(handle)}`)
