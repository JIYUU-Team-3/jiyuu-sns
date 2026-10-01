import { GIPHY_API_KEY } from '$app/env/private'
import type { Gif } from '#lib/posts/types'
import { cached } from './cache'

const API = 'https://api.giphy.com/v1/gifs'
const LIMIT = 24

/** GIPHY's own CDN hosts; a post's GIF must come from one of them. */
const GIF_HOST = /^(media\d*|i)\.giphy\.com$/

export function is_gif_url(url: string) {
	try {
		const parsed = new URL(url)
		return parsed.protocol === 'https:' && GIF_HOST.test(parsed.hostname)
	} catch {
		return false
	}
}

type Rendition = { url: string; width: string; height: string }
type GiphyItem = {
	id: string
	title: string
	images: { fixed_width: Rendition; downsized_medium?: Rendition; original: Rendition }
}

const size = (rendition: Rendition) => ({
	url: rendition.url,
	width: Number(rendition.width),
	height: Number(rendition.height),
})

function to_gif(item: GiphyItem): Gif {
	return {
		id: item.id,
		title: item.title,
		preview: size(item.images.fixed_width),
		full: size(item.images.downsized_medium ?? item.images.original),
	}
}

/** Whether a key is configured; without one the picker says GIFs are unavailable. */
export const gifs_enabled = () => !!GIPHY_API_KEY

/** Trending GIFs for an empty query, search results otherwise. */
export async function search_gifs(q: string, locale: string): Promise<Gif[]> {
	if (!GIPHY_API_KEY) return []
	const params = new URLSearchParams({
		api_key: GIPHY_API_KEY,
		limit: String(LIMIT),
		rating: 'pg-13',
	})
	if (q) params.set('q', q)
	params.set('lang', locale)
	const response = await fetch(`${API}/${q ? 'search' : 'trending'}?${params}`)
	if (!response.ok) throw new Error(`GIPHY ${response.status}`)
	const { data } = (await response.json()) as { data: GiphyItem[] }
	return data.map(to_gif).filter((gif) => is_gif_url(gif.full.url) && is_gif_url(gif.preview.url))
}

/** The ratings the picker shows (`rating: 'pg-13'` and below). */
const ALLOWED_RATINGS = new Set(['y', 'g', 'pg', 'pg-13'])

/** The GIF's id in a GIPHY CDN URL: `/media/<id>/…`, `/media/v1.<…>/<id>/…` or `i.giphy.com/<id>.gif`. */
export function gif_id(url: string) {
	try {
		const parsed = new URL(url)
		const parts = parsed.pathname.split('/').filter(Boolean)
		const id = parsed.hostname === 'i.giphy.com' ? parts[0]?.replace(/\.\w+$/, '') : parts.at(-2)
		return id && /^[A-Za-z0-9]{3,40}$/.test(id) ? id : undefined
	} catch {
		return undefined
	}
}

/**
 * Whether a GIF is one the picker would have offered, asked of GIPHY by id: a scripted client can
 * attach any GIPHY URL, not only the picker's. Ratings don't change, so answers are cached; a GIF
 * GIPHY won't vouch for is refused.
 */
export async function gif_allowed(url: string, fetcher: typeof fetch = fetch) {
	const id = gif_id(url)
	if (!id || !GIPHY_API_KEY) return false
	const rating = await cached<string | null>(
		`giphy-rating:${id}`,
		7 * 24 * 60 * 60,
		async () => {
			try {
				const params = new URLSearchParams({ api_key: GIPHY_API_KEY! })
				const response = await fetcher(`${API}/${id}?${params}`, {
					signal: AbortSignal.timeout(2000),
				})
				if (!response.ok) return null
				const { data } = (await response.json()) as { data?: { rating?: string } }
				return data?.rating ?? null
			} catch {
				return null
			}
		},
		(value) => value !== null,
	)
	return rating !== null && ALLOWED_RATINGS.has(rating)
}
