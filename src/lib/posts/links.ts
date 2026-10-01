import { localizeHref } from '#lib/paraglide/runtime'

/** A post's own page in the current locale, e.g. `/ja/p/…`. */
export const post_href = (id: string) => localizeHref(`/p/${encodeURIComponent(id)}`)

/** The same page as an absolute URL, for copying and sharing. */
export const post_url = (id: string) => new URL(post_href(id), location.origin).href

/** Search results for a query, e.g. a hashtag or a place. */
export const search_href = (q: string) => localizeHref(`/search?q=${encodeURIComponent(q)}`)

/** Posts with a hashtag; `tag` comes without its `#`. */
export const tag_href = (tag: string) => search_href(`#${tag}`)

/** The "leaving Jiyuu" page for a post's `n`th link. It takes ids, never a URL, so it can't be an open redirect. */
export const out_href = (post_id: string, n: number) =>
	localizeHref(`/out?post=${encodeURIComponent(post_id)}&n=${n}`)
