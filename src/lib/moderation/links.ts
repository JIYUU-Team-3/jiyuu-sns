import { localizeHref } from '#lib/localize-href'

/** The moderator's queue. */
export const mod_href = () => localizeHref('/mod')

/** The moderator's view of one account. */
export const mod_account_href = (handle: string) =>
	localizeHref(`/mod/u/${encodeURIComponent(handle)}`)

/** The moderator's view of one post, whatever its state. */
export const mod_post_href = (id: string) => localizeHref(`/mod/p/${encodeURIComponent(id)}`)
