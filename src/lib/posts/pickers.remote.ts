import * as v from 'valibot'
import { query } from '$app/server'
import { getLocale } from '#lib/paraglide/runtime'
import { gifs_enabled, search_gifs } from '#lib/server/gifs'
import { search_places } from '#lib/server/places'
import { limit } from '#lib/server/rate-limit'
import { signed_in } from '#lib/server/session'

const Q = v.pipe(v.string(), v.trim(), v.maxLength(80))

/**
 * The pickers call third-party APIs on the viewer's behalf, so they need a session, and a pace
 * that keeps us a light user of those APIs.
 */
const picker = () => limit('LOOKUP_LIMIT', signed_in().user_id)

/** GIFs for the composer's picker; `enabled` is false when no GIPHY key is configured. */
export const find_gifs = query(Q, async (q) => {
	await picker()
	if (!gifs_enabled()) return { enabled: false, gifs: [] }
	return { enabled: true, gifs: await search_gifs(q, getLocale()) }
})

/** Places matching what's typed in the composer's location search. */
export const find_places = query(Q, async (q) => {
	await picker()
	if (q.length < 2) return []
	return search_places(q, getLocale())
})
