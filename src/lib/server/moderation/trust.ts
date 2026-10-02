import { and, count, eq, gt, inArray, sql } from 'drizzle-orm'
import { post_length } from '#lib/posts/rules'
import type { getDb } from '../db'
import { follow, post, user } from '../db/schema'

type Db = ReturnType<typeof getDb>

/**
 * How much an account is trusted, which decides its limits and how much of what it posts is
 * checked. `new` and `restricted` share the strictest limits. See docs/MODERATION.md.
 */
export type Trust = 'new' | 'normal' | 'trusted' | 'restricted'

const DAY = 24 * 60 * 60 * 1000

/** An account is new for its first days, and until it has a few posts nobody took down. */
export const NEW_DAYS = 3
export const NEW_POSTS = 3
/** Trusted after a month, twenty posts, and three clean months. */
export const TRUSTED_DAYS = 30
export const TRUSTED_POSTS = 20
export const CLEAN_DAYS = 90

/** Whether an account is held to new-account limits: no links, no video, a slower pace. */
export const is_limited = (trust: Trust) => trust === 'new' || trust === 'restricted'

/**
 * The outer row's id, spelled out: in a one-table query Drizzle writes `${user.id}` as a bare
 * `"id"`, which inside a subquery would mean the subquery's own table.
 */
const account_id = sql.raw('"user"."id"')

export async function trust_level(db: Db, user_id: string, now = Date.now()): Promise<Trust> {
	const since = now - CLEAN_DAYS * DAY
	const [row] = await db
		.select({
			created_at: user.createdAt,
			restricted: sql<number>`coalesce((select s.restricted from account_standing s where s.user_id = ${account_id}), 0)`,
			// One index range on `post_author_created_idx`.
			posts: sql<number>`(select count(*) from post p where p.author_id = ${account_id} and p.moderation = 'visible')`,
			actions: sql<number>`(select count(*) from moderation_action a where a.target_user_id = ${account_id} and a.reversed_at is null and a.action in ('warn', 'limit', 'remove', 'suspend') and a.created_at > ${since})`,
		})
		.from(user)
		.where(eq(user.id, user_id))
		.limit(1)
	if (!row) return 'new'
	if (row.restricted) return 'restricted'
	const age = now - row.created_at.getTime()
	if (age < NEW_DAYS * DAY || row.posts < NEW_POSTS) return 'new'
	if (age >= TRUSTED_DAYS * DAY && row.posts >= TRUSTED_POSTS && row.actions === 0) return 'trusted'
	return 'normal'
}

/** A new or restricted account's pace: posts (replies included) and follows an hour. */
export const LIMITED_POSTS_PER_HOUR = 10
export const LIMITED_FOLLOWS_PER_HOUR = 20

const HOUR = 60 * 60 * 1000

export async function posts_last_hour(db: Db, user_id: string, now = Date.now()) {
	const [row] = await db
		.select({ n: count() })
		.from(post)
		.where(and(eq(post.authorId, user_id), gt(post.createdAt, new Date(now - HOUR))))
	return row?.n ?? 0
}

export async function follows_last_hour(db: Db, user_id: string, now = Date.now()) {
	const [row] = await db
		.select({ n: count() })
		.from(follow)
		.where(and(eq(follow.followerId, user_id), gt(follow.createdAt, new Date(now - HOUR))))
	return row?.n ?? 0
}

/** Text this short can repeat by chance ("good morning"); longer repeats are spam. */
export const DUPLICATE_MIN_LENGTH = 10
const DUPLICATE_WINDOW = DAY

/** Whether any of `bodies` repeats one of the author's own posts from the last day. */
export async function repeats_own_post(
	db: Db,
	user_id: string,
	bodies: string[],
	now = Date.now(),
) {
	const long = [...new Set(bodies.filter((body) => post_length(body) >= DUPLICATE_MIN_LENGTH))]
	if (!long.length) return false
	const [row] = await db
		.select({ id: post.id })
		.from(post)
		.where(
			and(
				eq(post.authorId, user_id),
				gt(post.createdAt, new Date(now - DUPLICATE_WINDOW)),
				inArray(post.body, long),
			),
		)
		.limit(1)
	return !!row
}

/** Whether `other` follows `me`, which lets a new account start a chat with them. */
export async function follows(db: Db, follower: string, following: string) {
	const [row] = await db
		.select({ one: sql<number>`1` })
		.from(follow)
		.where(and(eq(follow.followerId, follower), eq(follow.followingId, following)))
		.limit(1)
	return !!row
}
