import type { Place } from '#lib/posts/types'

/**
 * Photon (komoot) searches OpenStreetMap and, unlike the public Nominatim server, allows
 * search-as-you-type. Results are cached in KV for a day to stay a light user of it.
 */
const API = 'https://photon.komoot.io/api/'
const LIMIT = 6
const CACHE_TTL = 24 * 60 * 60
/** Photon only has these; anything else gets local names. */
const PHOTON_LANGS = new Set(['en', 'de', 'fr'])

type Feature = {
	properties: { name?: string; city?: string; state?: string; country?: string }
}

/** Name plus the wider areas it sits in, skipping repeats such as a city named like its state. */
export function to_place({ properties: p }: Feature): Place | undefined {
	if (!p.name) return undefined
	const areas = [p.city, p.state, p.country].filter(
		(area, i, all): area is string => !!area && area !== p.name && all.indexOf(area) === i,
	)
	const name = [p.name, areas.at(-1)].filter(Boolean).join(', ')
	return { name, detail: areas.slice(0, -1).join(', ') }
}

function unique_places(features: Feature[]) {
	const places = features.map(to_place).filter((place): place is Place => !!place)
	return places.filter((place, i) => places.findIndex((p) => p.name === place.name) === i)
}

async function fetch_places(q: string, locale: string): Promise<Place[]> {
	const params = new URLSearchParams({ q, limit: String(LIMIT) })
	if (PHOTON_LANGS.has(locale)) params.set('lang', locale)
	const response = await fetch(`${API}?${params}`, {
		headers: { 'user-agent': 'Jiyuu SNS (class project; composer location search)' },
	})
	if (!response.ok) throw new Error(`Photon ${response.status}`)
	const { features } = (await response.json()) as { features: Feature[] }
	return unique_places(features)
}

export async function search_places(kv: KVNamespace, q: string, locale: string) {
	const key = `places:${locale}:${q.toLowerCase()}`
	const cached = await kv.get<Place[]>(key, 'json')
	if (cached) return cached
	const places = await fetch_places(q, locale)
	await kv.put(key, JSON.stringify(places), { expirationTtl: CACHE_TTL })
	return places
}
