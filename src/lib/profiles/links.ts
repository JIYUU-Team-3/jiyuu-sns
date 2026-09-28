import { localizeHref } from '#lib/paraglide/runtime'

export const profile_href = (handle: string) => localizeHref(`/u/${encodeURIComponent(handle)}`)
