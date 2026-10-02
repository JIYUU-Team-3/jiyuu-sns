import * as v from 'valibot'
import { getRequestEvent, query } from '$app/server'
import { limit } from '#lib/server/rate-limit'
import * as search from '#lib/server/search'
import { signed_in } from '#lib/server/session'

const Query = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(100))
const Cursor = v.optional(v.pipe(v.string(), v.maxLength(80)))

/** Search is for signed-in people, at a pace typing reaches and a scraper doesn't. */
async function searcher() {
	const me = signed_in()
	await limit('LOOKUP_LIMIT', me.user_id)
	return me.user_id
}

export const search_posts = query(
	v.object({ q: Query, tab: v.picklist(['top', 'latest']), cursor: Cursor }),
	async ({ q, tab, cursor }) =>
		search.search_posts(getRequestEvent().locals.db, await searcher(), q, tab, cursor),
)

export const search_people = query(Query, async (q) =>
	search.search_people(getRequestEvent().locals.db, await searcher(), q),
)

export const search_tags = query(Query, async (q) => {
	await searcher()
	return search.search_tags(getRequestEvent().locals.db, q)
})

/** What the search box lists while someone types. */
export const search_suggestions = query(Query, async (q) =>
	search.suggestions(getRequestEvent().locals.db, await searcher(), q),
)

export const get_trending = query(
	v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(20)),
	(limit) => {
		const { db, user_id } = signed_in()
		return search.trending_tags(db, limit, user_id)
	},
)

export const get_who_to_follow = query(
	v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(20)),
	(limit) => {
		const { db, user_id } = signed_in()
		return search.who_to_follow(db, user_id, limit)
	},
)
