import { error } from '@sveltejs/kit'
import { env } from 'cloudflare:workers'
import * as v from 'valibot'
import { getRequestEvent, query } from '$app/server'
import { getLocale } from '#lib/paraglide/runtime'
import { gifs_enabled, search_gifs } from '#lib/server/gifs'
import { search_places } from '#lib/server/places'

const Q = v.pipe(v.string(), v.trim(), v.maxLength(80))

/** The pickers call third-party APIs on the viewer's behalf, so they need a session. */
function signed_in() {
	if (!getRequestEvent().locals.user) error(401, 'Sign in to continue.')
}

/** GIFs for the composer's picker; `enabled` is false when no GIPHY key is configured. */
export const find_gifs = query(Q, async (q) => {
	signed_in()
	if (!gifs_enabled()) return { enabled: false, gifs: [] }
	return { enabled: true, gifs: await search_gifs(q, getLocale()) }
})

/** Places matching what's typed in the composer's location search. */
export const find_places = query(Q, async (q) => {
	signed_in()
	if (q.length < 2) return []
	return search_places(env.KV, q, getLocale())
})
