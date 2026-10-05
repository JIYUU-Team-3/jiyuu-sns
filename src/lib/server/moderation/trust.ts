import { and, count, eq, gt, inArray, sql } from 'drizzle-orm'
import { post_length } from '#lib/posts/rules'
import type { getDb } from '../db'
import { follow, newAccountAllowance, post, user } from '../db/schema'
import { today } from './budget'

type Db = ReturnType<typeof getDb>

/**
 * How much an account is trusted, which decides its limits and how much of what it posts is
 * checked. `new` and `restricted` share the strictest limits. See docs/MODERATION.md.
 */
export type Trust = 'new' | 'normal' | 'trusted' | 'restricted'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

/** An account is new for its first hours, and its links go through the "leaving Jiyuu" page. */
export const NEW_HOURS = 6
/** Trusted after a month, twenty posts, and three clean months. */
export const TRUSTED_DAYS = 30
export const TRUSTED_POSTS = 20
export const CLEAN_DAYS = 90

/**
 * Whether an account is held to new-account limits: a slower pace, and links and video only
 * within the daily allowance (none at all when restricted).
 */
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
	if (age < NEW_HOURS * HOUR) return 'new'
	if (age >= TRUSTED_DAYS * DAY && row.posts >= TRUSTED_POSTS && row.actions === 0) return 'trusted'
	return 'normal'
}

/** A new or restricted account's pace: posts (replies included) and follows an hour. */
export const LIMITED_POSTS_PER_HOUR = 10
export const LIMITED_FOLLOWS_PER_HOUR = 20

/**
 * What a new account may share each UTC day: posts, edits and messages that add a link, and
 * videos. A restricted account gets none.
 */
export const NEW_ALLOWANCE = { links: 5, videos: 5 } as const
export type Allowance = keyof typeof NEW_ALLOWANCE

/**
 * Use `wanted` of today's allowance, or none of it when any kind would pass its cap. Returns the
 * kind that ran out, or `undefined` when it was all granted.
 */
export async function use_allowance(
	db: Db,
	user_id: string,
	wanted: Partial<Record<Allowance, number>>,
	now = Date.now(),
): Promise<Allowance | undefined> {
	const links = wanted.links ?? 0
	const videos = wanted.videos ?? 0
	if (!links && !videos) return undefined
	if (links > NEW_ALLOWANCE.links) return 'links'
	if (videos > NEW_ALLOWANCE.videos) return 'videos'
	// One statement: the row is created or added to only while both totals stay under their caps.
	const rows = await db
		.insert(newAccountAllowance)
		.values({ userId: user_id, day: today(now), links, videos })
		.onConflictDoUpdate({
			target: [newAccountAllowance.userId, newAccountAllowance.day],
			set: {
				links: sql`${newAccountAllowance.links} + ${links}`,
				videos: sql`${newAccountAllowance.videos} + ${videos}`,
			},
			setWhere: sql`${newAccountAllowance.links} + ${links} <= ${NEW_ALLOWANCE.links} and ${newAccountAllowance.videos} + ${videos} <= ${NEW_ALLOWANCE.videos}`,
		})
		.returning({ day: newAccountAllowance.day })
	if (rows.length) return undefined
	const left = await allowance_left(db, user_id, now)
	return left.links < links ? 'links' : 'videos'
}

/** What is left of today's allowance. */
export async function allowance_left(db: Db, user_id: string, now = Date.now()) {
	const [row] = await db
		.select({ links: newAccountAllowance.links, videos: newAccountAllowance.videos })
		.from(newAccountAllowance)
		.where(and(eq(newAccountAllowance.userId, user_id), eq(newAccountAllowance.day, today(now))))
		.limit(1)
	return {
		links: NEW_ALLOWANCE.links - (row?.links ?? 0),
		videos: NEW_ALLOWANCE.videos - (row?.videos ?? 0),
	}
}

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
