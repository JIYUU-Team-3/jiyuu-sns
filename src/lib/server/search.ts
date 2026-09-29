import { and, desc, eq, gte, inArray, ne, notExists, or, sql } from 'drizzle-orm'
import { normalize_tag } from '#lib/posts/text'
import type { PostPage } from '#lib/posts/types'
import type { TagView, UserView } from '#lib/search/types'
import type { getDb } from './db'
import { follow, post, postTag, profile, user } from './db/schema'
import { after, like_count, page, PAGE_SIZE, reply_count, select_posts, to_page } from './posts'

type Db = ReturnType<typeof getDb>

/** Trending counts the last week of posts. */
const TRENDING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

/** `%` and `_` in the query are matched literally, not as LIKE wildcards. */
const escape_like = (text: string) => text.replace(/[\\%_]/g, (char) => `\\${char}`)

const contains = (text: string) => `%${escape_like(text)}%`
const starts_with = (text: string) => `${escape_like(text)}%`

/** `#svelte` searches that tag exactly; anything else searches post text. */
function post_filter(db: Db, q: string) {
	if (q.startsWith('#') && q.length > 1) {
		const tag = normalize_tag(q.slice(1))
		return inArray(
			post.id,
			db.select({ id: postTag.postId }).from(postTag).where(eq(postTag.tag, tag)),
		)
	}
	return sql`${post.body} like ${contains(q)} escape '\\'`
}

/** Latest: newest first. Top: most liked and replied to first, paged by offset. */
export async function search_posts(
	db: Db,
	viewer: string | undefined,
	q: string,
	tab: 'top' | 'latest',
	cursor: string | undefined,
): Promise<PostPage> {
	const filter = post_filter(db, q)
	if (tab === 'latest')
		return page(db, viewer, [filter, after(cursor, 'newer_first')], 'newer_first')

	const offset = Math.max(0, Number(cursor) || 0)
	const rows = await select_posts(db, viewer)
		.where(filter)
		.orderBy(desc(sql`${like_count} + 2 * ${reply_count}`), desc(post.createdAt), desc(post.id))
		.limit(PAGE_SIZE + 1)
		.offset(offset)
	return to_page(rows, viewer, () => String(offset + PAGE_SIZE))
}

const follower_count = sql<number>`(select count(*) from follow f where f.following_id = ${profile.userId})`

function select_users(db: Db, viewer: string | undefined) {
	return db
		.select({
			id: profile.userId,
			handle: profile.handle,
			name: profile.displayName,
			bio: profile.bio,
			image: sql<string | null>`coalesce(${profile.avatarUrl}, ${user.image})`,
			followed: viewer
				? sql<number>`exists(select 1 from follow f where f.follower_id = ${viewer} and f.following_id = ${profile.userId})`
				: sql<number>`0`,
		})
		.from(profile)
		.innerJoin(user, eq(user.id, profile.userId))
		.$dynamic()
}

type UserRow = Awaited<ReturnType<ReturnType<typeof select_users>['execute']>>[number]

const to_user = (row: UserRow, viewer: string | undefined): UserView => ({
	...row,
	image: row.image ?? undefined,
	followed: !!row.followed,
	mine: row.id === viewer,
})

/** People whose handle starts with the query or whose name contains it; exact handles first. */
export async function search_people(db: Db, viewer: string | undefined, q: string) {
	const needle = q.replace(/^@/, '').trim()
	if (!needle) return []
	const rows = await select_users(db, viewer)
		.where(
			or(
				sql`${profile.handle} like ${starts_with(needle.toLowerCase())} escape '\\'`,
				sql`${profile.displayName} like ${contains(needle)} escape '\\'`,
			),
		)
		.orderBy(desc(sql`${profile.handle} = ${needle.toLowerCase()}`), desc(follower_count))
		.limit(PAGE_SIZE)
	return rows.map((row) => to_user(row, viewer))
}

/** Tags starting with the query, most used first. */
export async function search_tags(db: Db, q: string): Promise<TagView[]> {
	const needle = normalize_tag(q.replace(/^#/, '').trim())
	if (!needle) return []
	const posts = sql<number>`count(*)`
	return db
		.select({ tag: postTag.tag, posts })
		.from(postTag)
		.where(sql`${postTag.tag} like ${starts_with(needle)} escape '\\'`)
		.groupBy(postTag.tag)
		.orderBy(desc(posts), postTag.tag)
		.limit(PAGE_SIZE)
}

/** The most used tags of the last week. */
export async function trending_tags(db: Db, limit: number): Promise<TagView[]> {
	const posts = sql<number>`count(*)`
	return db
		.select({ tag: postTag.tag, posts })
		.from(postTag)
		.where(gte(postTag.createdAt, new Date(Date.now() - TRENDING_WINDOW_MS)))
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
