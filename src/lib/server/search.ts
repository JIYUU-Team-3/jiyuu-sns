import { and, desc, eq, gte, inArray, ne, notExists, or, sql, type SQLWrapper } from 'drizzle-orm'
import { normalize_tag } from '#lib/posts/text'
import type { PostPage } from '#lib/posts/types'
import { PLACE_MIN, place_key } from '#lib/search/place'
import type { TagView, UserView } from '#lib/search/types'
import { shown_image } from './account-image'
import { is_moderator } from './moderation/standing'
import type { getDb } from './db'
import { follow, post, postTag, profile, user } from './db/schema'
import { typo_budget, typo_match } from './fuzzy'
import { unmuted_posts, visible_people, visible_posts } from './safety'
import {
	after,
	last_at_cap,
	like_count,
	OFFSET_MAX,
	page,
	PAGE_SIZE,
	reply_count,
	select_posts,
	to_page,
} from './posts'

type Db = ReturnType<typeof getDb>

/** Trending counts the last week of posts. */
const TRENDING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

/**
 * `%` and `_` in the query are matched literally, not as LIKE wildcards. Every LIKE here says
 * `escape '!'`, which (unlike a backslash) needs no escaping in the SQL template strings.
 */
const escape_like = (text: string) => text.replace(/[!%_]/g, (char) => `!${char}`)

const contains = (text: string) => `%${escape_like(text)}%`

/** Tags count only on posts everyone can see, so a hidden post never trends or shows in counts. */
const tag_shown = sql`exists(select 1 from post p where p.id = ${postTag.postId} and p.moderation = 'visible')`
const starts_with = (text: string) => `${escape_like(text)}%`

/**
 * Whether `column` names the place in `q`, either way round: the stored place contains the query
 * (`Phnom Penh` finds `Phnom Penh Municipality`), or the query contains the stored place's first
 * part (`Phnom Penh Municipality` finds `Phnom Penh, Cambodia`). Undefined for a query too short
 * to be a place.
 */
function place_like(column: SQLWrapper, q: string) {
	const key = place_key(q)
	if ([...key].length < PLACE_MIN) return undefined
	const stored = sql`trim(substr(${column}, 1, instr(${column} || ',', ',') - 1))`
	return sql`(${column} like ${contains(key)} escape '!' or (length(${stored}) >= ${PLACE_MIN} and instr(lower(${key}), lower(${stored})) > 0))`
}

/** `#svelte` searches that tag exactly; anything else searches post text and the post's place. */
function post_filter(db: Db, q: string) {
	if (q.startsWith('#') && q.length > 1) {
		const tag = normalize_tag(q.slice(1))
		return inArray(
			post.id,
			db.select({ id: postTag.postId }).from(postTag).where(eq(postTag.tag, tag)),
		)
	}
	return or(sql`${post.body} like ${contains(q)} escape '!'`, place_like(post.location, q))
}

/** Latest: newest first. Top: most liked and replied to first, paged by offset. */
export async function search_posts(
	db: Db,
	viewer: string | undefined,
	q: string,
	tab: 'top' | 'latest',
	cursor: string | undefined,
): Promise<PostPage> {
	const filter = and(post_filter(db, q), unmuted_posts(viewer))
	if (tab === 'latest')
		return page(db, viewer, [filter, after(cursor, 'newer_first')], 'newer_first')

	const offset = Math.min(OFFSET_MAX, Math.max(0, Number(cursor) || 0))
	const rows = await select_posts(db, viewer)
		.where(and(visible_posts(viewer), filter))
		.orderBy(desc(sql`${like_count} + 2 * ${reply_count}`), desc(post.createdAt), desc(post.id))
		.limit(PAGE_SIZE + 1)
		.offset(offset)
	return last_at_cap(
		to_page(rows, viewer, () => String(offset + PAGE_SIZE)),
		offset,
	)
}

const follower_count = sql<number>`(select count(*) from follow f where f.following_id = ${profile.userId})`

function select_users(db: Db, viewer: string | undefined) {
	return db
		.select({
			id: profile.userId,
			handle: profile.handle,
			name: profile.displayName,
			bio: profile.bio,
			location: profile.location,
			image: shown_image,
			moderator: is_moderator(profile.userId),
			followed: viewer
				? sql<number>`exists(select 1 from follow f where f.follower_id = ${viewer} and f.following_id = ${profile.userId})`
				: sql<number>`0`,
			private: profile.isPrivate,
			requested: viewer
				? sql<number>`exists(select 1 from follow_request r where r.requester_id = ${viewer} and r.target_id = ${profile.userId})`
				: sql<number>`0`,
		})
		.from(profile)
		.innerJoin(user, eq(user.id, profile.userId))
		.$dynamic()
}

type UserRow = Awaited<ReturnType<ReturnType<typeof select_users>['execute']>>[number]

const to_user = (row: UserRow, viewer: string | undefined): UserView => ({
	...row,
	location: row.location || undefined,
	image: row.image ?? undefined,
	moderator: row.moderator ? true : undefined,
	followed: !!row.followed,
	requested: !!row.requested,
	mine: row.id === viewer,
})

/**
 * How close an account is to what was typed, lower is closer: the exact handle, then the exact
 * name, then handles and names that start with it, a word in the name that starts with it, and
 * last anything that merely contains it.
 */
function closeness(needle: string) {
	const lower = needle.toLowerCase()
	const name = sql`lower(${profile.displayName})`
	return sql<number>`case
		when ${profile.handle} = ${lower} then 0
		when ${name} = ${lower} then 1
		when ${profile.handle} like ${starts_with(lower)} escape '!' then 2
		when ${name} like ${starts_with(lower)} escape '!' then 3
		when ${name} like ${`% ${escape_like(lower)}%`} escape '!' then 4
		when ${profile.handle} like ${contains(lower)} escape '!' then 5
		when ${name} like ${contains(lower)} escape '!' then 6
		else 7
	end`
}

/**
 * People whose handle or name contains the query, closest first, then people whose location does.
 * Among equally close ones, shorter handles (nearer to what was typed) and then more followed
 * accounts come first.
 */
export async function search_people(
	db: Db,
	viewer: string | undefined,
	q: string,
	limit = PAGE_SIZE,
) {
	const needle = q.replace(/^@/, '').trim()
	if (!needle) return []
	const rows = await select_users(db, viewer)
		.where(
			and(
				visible_people(viewer),
				or(
					sql`${profile.handle} like ${contains(needle.toLowerCase())} escape '!'`,
					sql`${profile.displayName} like ${contains(needle)} escape '!'`,
					place_like(profile.location, needle),
				),
			),
		)
		.orderBy(closeness(needle), sql`length(${profile.handle})`, desc(follower_count))
		.limit(limit)
	const people = rows.map((row) => to_user(row, viewer))
	if (people.length >= limit || !typo_budget([...needle].length)) return people
	return [...people, ...(await near_misses(db, viewer, needle, people, limit - people.length))]
}

/**
 * How many accounts typo matching looks through, most followed first. Plenty for this app;
 * a much bigger one would want a real search index instead.
 */
const TYPO_CANDIDATES = 2000

/** Accounts a typo or two away from the query, fewest typos and then most followed first. */
async function near_misses(
	db: Db,
	viewer: string | undefined,
	needle: string,
	found: UserView[],
	limit: number,
) {
	const seen = new Set(found.map((user) => user.id))
	const candidates = await db
		.select({ id: profile.userId, handle: profile.handle, name: profile.displayName })
		.from(profile)
		.orderBy(desc(follower_count))
		.limit(TYPO_CANDIDATES)
	const ranked = candidates
		.flatMap((candidate) => {
			if (seen.has(candidate.id)) return []
			const typos = typo_match(needle, candidate.handle, candidate.name)
			return typos === undefined ? [] : [{ id: candidate.id, typos }]
		})
		// Stable, so equally close accounts stay most followed first.
		.sort((a, b) => a.typos - b.typos)
		.slice(0, limit)
		.map((match) => match.id)
	if (!ranked.length) return []
	const rows = await select_users(db, viewer).where(
		and(visible_people(viewer), inArray(profile.userId, ranked)),
	)
	const by_id = new Map(rows.map((row) => [row.id, to_user(row, viewer)]))
	return ranked.flatMap((id) => by_id.get(id) ?? [])
}

/** Tags starting with the query, most used first. */
export async function search_tags(db: Db, q: string, limit = PAGE_SIZE): Promise<TagView[]> {
	const needle = normalize_tag(q.replace(/^#/, '').trim())
	if (!needle) return []
	const posts = sql<number>`count(*)`
	return db
		.select({ tag: postTag.tag, posts })
		.from(postTag)
		.where(and(sql`${postTag.tag} like ${starts_with(needle)} escape '!'`, tag_shown))
		.groupBy(postTag.tag)
		.orderBy(desc(posts), postTag.tag)
		.limit(limit)
}

/**
 * What the search box offers while someone types: tags for a `#` query, otherwise the closest
 * people.
 */
export async function suggestions(db: Db, viewer: string | undefined, q: string) {
	if (q.startsWith('#')) return { people: [], tags: await search_tags(db, q, 5) }
	return { people: await search_people(db, viewer, q, 6), tags: [] }
}

/** The most used tags of the last week. */
export async function trending_tags(db: Db, limit: number, viewer?: string): Promise<TagView[]> {
	const posts = sql<number>`count(*)`
	return db
		.select({ tag: postTag.tag, posts })
		.from(postTag)
		.where(
			and(
				gte(postTag.createdAt, new Date(Date.now() - TRENDING_WINDOW_MS)),
				tag_shown,
				viewer
					? sql`not exists(select 1 from muted_term t where t.user_id = ${viewer} and t.term = '#' || ${postTag.tag})`
					: undefined,
			),
		)
		.groupBy(postTag.tag)
		.orderBy(desc(posts), postTag.tag)
		.limit(limit)
}

/** Accounts the viewer doesn't follow yet, most followed first. */
export async function who_to_follow(db: Db, viewer: string, limit: number) {
	const rows = await select_users(db, viewer)
		.where(
			and(
				ne(profile.userId, viewer),
				visible_people(viewer),
				notExists(
					db
						.select({ one: sql`1` })
						.from(follow)
						.where(and(eq(follow.followerId, viewer), eq(follow.followingId, profile.userId))),
				),
			),
		)
		.orderBy(desc(follower_count), desc(profile.createdAt))
		.limit(limit)
	return rows.map((row) => to_user(row, viewer))
}
