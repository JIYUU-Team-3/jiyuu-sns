import { error } from '@sveltejs/kit'
import * as v from 'valibot'
import { getRequestEvent, query } from '$app/server'
import * as search from '#lib/server/search'

const Query = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(100))
const Cursor = v.optional(v.pipe(v.string(), v.maxLength(80)))

function viewer() {
	return getRequestEvent().locals.user?.id
}

export const search_posts = query(
	v.object({ q: Query, tab: v.picklist(['top', 'latest']), cursor: Cursor }),
	({ q, tab, cursor }) =>
		search.search_posts(getRequestEvent().locals.db, viewer(), q, tab, cursor),
)

export const search_people = query(Query, (q) =>
	search.search_people(getRequestEvent().locals.db, viewer(), q),
)

export const search_tags = query(Query, (q) => search.search_tags(getRequestEvent().locals.db, q))

export const get_trending = query(
	v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(20)),
	(limit) => search.trending_tags(getRequestEvent().locals.db, limit),
)

export const get_who_to_follow = query(
	v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(20)),
	(limit) => {
		const { locals } = getRequestEvent()
		if (!locals.user) error(401, 'Sign in to continue.')
		return search.who_to_follow(locals.db, locals.user.id, limit)
	},
)
