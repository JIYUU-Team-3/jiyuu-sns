import { localizeHref } from '#lib/paraglide/runtime'

/** The moderator's queue. */
export const mod_href = () => localizeHref('/mod')

/** The moderator's view of one account. */
export const mod_account_href = (handle: string) =>
	localizeHref(`/mod/u/${encodeURIComponent(handle)}`)
