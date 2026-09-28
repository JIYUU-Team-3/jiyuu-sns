import { localizeHref } from '#lib/paraglide/runtime'

/** A post's own page in the current locale, e.g. `/ja/p/…`. */
export const post_href = (id: string) => localizeHref(`/p/${encodeURIComponent(id)}`)

/** The same page as an absolute URL, for copying and sharing. */
export const post_url = (id: string) => new URL(post_href(id), location.origin).href
