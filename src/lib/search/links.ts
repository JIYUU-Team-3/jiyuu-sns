import { localizeHref } from '#lib/localize-href'

export type SearchTab = 'top' | 'latest' | 'people' | 'tags'

/** Search results in the current locale, e.g. `#svelte` → `/ja/search?q=%23svelte`. */
export function search_href(q: string, tab?: SearchTab) {
	const params = new URLSearchParams({ q })
	if (tab && tab !== 'top') params.set('tab', tab)
	return localizeHref(`/search?${params}`)
}

/** Posts with one hashtag; `tag` comes without the `#`. */
export const tag_href = (tag: string) => search_href(`#${tag}`)

/** Trending tags and people to follow. */
export const explore_href = () => localizeHref('/explore')
