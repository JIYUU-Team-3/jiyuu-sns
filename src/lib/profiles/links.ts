import { localizeHref } from '#lib/paraglide/runtime'

export const profile_href = (handle: string) => localizeHref(`/u/${encodeURIComponent(handle)}`)

/** Where you edit your own profile. */
export const edit_profile_href = () => localizeHref('/settings/profile')
