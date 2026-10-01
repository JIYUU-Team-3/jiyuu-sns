import { and, desc, eq, gt, inArray, ne, sql } from 'drizzle-orm'
import type { getDb } from '../db'
import {
	accountStanding,
	conversation,
	follow,
	moderationAction,
	moderationCase,
	post,
} from '../db/schema'
import { chunks } from '../db/chunks'
import { raise_case } from './cases'
import { links_in } from './links'

type Db = ReturnType<typeof getDb>

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

/** At or over this, an account is restricted and a moderator is asked to look. */
export const SCORE_THRESHOLD = 60
/** Most accounts scored in one run, the most recently active first. */
export const SCORED_PER_RUN = 200

export type Signals = {
	posts_last_hour: number
	/** Of the last day's posts, the share that repeat another once digits and punctuation go. */
	near_duplicates: number
	links_per_post: number
	follows_last_hour: number
	/** Chats started in the last day with someone who doesn't follow the account. */
	cold_chats: number
	/** Reports on the account's posts, profile and messages over the last week. */
	reports: number
	/** Moderator and automatic actions against it in the last 90 days, not reversed. */
	actions: number
}

/** Each signal's points, capped, so no one habit alone crosses the threshold. */
export function score_of(s: Signals) {
	const points =
		Math.min(30, s.posts_last_hour * 2) +
		(s.near_duplicates >= 0.5 ? Math.round(s.near_duplicates * 30) : 0) +
		Math.min(15, Math.round(s.links_per_post * 5)) +
		Math.min(20, s.follows_last_hour) +
		Math.min(20, s.cold_chats * 4) +
		Math.min(20, s.reports * 4) +
		Math.min(20, s.actions * 10)
	return Math.min(100, points)
}

/** Text as a template: `Win 500 coins!!` and `win 20 coins` are the same message. */
const skeleton = (body: string) =>
	body
		.toLowerCase()
		.replace(/https?:\/\/\S+/g, 'link')
		.replace(/[^\p{L}]+/gu, ' ')
		.trim()

export function near_duplicate_share(bodies: string[]) {
	const long = bodies.map(skeleton).filter((text) => text.length >= 10)
	if (long.length < 3) return 0
	const counts = new Map<string, number>()
	for (const text of long) counts.set(text, (counts.get(text) ?? 0) + 1)
	const repeated = long.filter((text) => (counts.get(text) ?? 0) > 1).length
	return repeated / long.length
}

/** Everything the score reads about one account, in a few queries. */
export async function signals(db: Db, user_id: string, now = Date.now()): Promise<Signals> {
	const [counts] = await db.all<Omit<Signals, 'near_duplicates' | 'links_per_post'>>(sql`select
		(select count(*) from post p where p.author_id = ${user_id} and p.created_at > ${now - HOUR})
			as posts_last_hour,
		(select count(*) from follow f where f.follower_id = ${user_id} and f.created_at > ${now - HOUR})
			as follows_last_hour,
		(select count(*) from conversation c where c.created_by = ${user_id} and c.created_at > ${now - DAY}
			and exists(select 1 from conversation_member m where m.conversation_id = c.id and m.user_id != ${user_id}
				and not exists(select 1 from follow f where f.follower_id = m.user_id and f.following_id = ${user_id})))
			as cold_chats,
		(select coalesce(sum(k.reports), 0) from moderation_case k where k.target_user_id = ${user_id}
			and k.updated_at > ${now - 7 * DAY}) as reports,
		(select count(*) from moderation_action a where a.target_user_id = ${user_id} and a.reversed_at is null
			and a.action in ('warn', 'limit', 'remove', 'suspend') and a.created_at > ${now - 90 * DAY}) as actions`)
	const recent = await db
		.select({ body: post.body })
		.from(post)
		.where(and(eq(post.authorId, user_id), gt(post.createdAt, new Date(now - DAY))))
		.orderBy(desc(post.createdAt))
		.limit(100)
	const links = recent.reduce((total, row) => total + links_in(row.body).length, 0)
	return {
		posts_last_hour: counts.posts_last_hour,
		near_duplicates: near_duplicate_share(recent.map((row) => row.body)),
		links_per_post: recent.length ? links / recent.length : 0,
		follows_last_hour: counts.follows_last_hour,
		cold_chats: counts.cold_chats,
		reports: counts.reports,
		actions: counts.actions,
	}
}

/**
 * Accounts that did something in the last two hours, the most recently active first, which are
 * the ones worth scoring.
 */
async function active_accounts(db: Db, now: number) {
	const since = new Date(now - 2 * HOUR)
	const last = sql<number>`max(created_at)`
	const [posters, followers, chatters, reported] = await db.batch([
		db
			.select({ id: post.authorId, at: last })
			.from(post)
			.where(gt(post.createdAt, since))
			.groupBy(post.authorId),
		db
			.select({ id: follow.followerId, at: last })
			.from(follow)
			.where(gt(follow.createdAt, since))
			.groupBy(follow.followerId),
		db
			.select({ id: conversation.createdBy, at: last })
			.from(conversation)
			.where(gt(conversation.createdAt, since))
			.groupBy(conversation.createdBy),
		db
			.select({ id: moderationCase.targetUserId, at: sql<number>`max(updated_at)` })
			.from(moderationCase)
			.where(gt(moderationCase.updatedAt, since))
			.groupBy(moderationCase.targetUserId),
	])
	const latest = new Map<string, number>()
	for (const row of [...posters, ...followers, ...chatters, ...reported]) {
		if (row.id) latest.set(row.id, Math.max(latest.get(row.id) ?? 0, Number(row.at)))
	}
	return [...latest]
		.sort((a, b) => b[1] - a[1])
		.slice(0, SCORED_PER_RUN)
		.map(([id]) => id)
}

/**
 * Score the recently active accounts. One at or over the threshold is restricted (the limits of a
 * new account) and put in front of a moderator; nobody is suspended by a score. Moderators aren't
 * scored. Returns how many were scored and how many newly restricted.
 */
export async function run_scores(db: Db, now = Date.now()) {
	const ids = await active_accounts(db, now)
	if (!ids.length) return { scored: 0, restricted: 0 }
	const standing = new Map<string, { role: 'member' | 'moderator'; restricted: boolean }>()
	for (const part of chunks(ids)) {
		const rows = await db
			.select({
				id: accountStanding.userId,
				role: accountStanding.role,
				restricted: accountStanding.restricted,
			})
			.from(accountStanding)
			.where(inArray(accountStanding.userId, part))
		for (const row of rows) standing.set(row.id, row)
	}
	let restricted = 0
	for (const user_id of ids) {
		const known = standing.get(user_id)
		if (known?.role === 'moderator') continue
		const found = await signals(db, user_id, now)
		const score = score_of(found)
		const restrict = score >= SCORE_THRESHOLD && !known?.restricted
		await db
			.insert(accountStanding)
			.values({
				userId: user_id,
				behaviourScore: score,
				scoredAt: new Date(now),
				...(restrict && { restricted: true, restrictedBy: 'score' as const }),
			})
			.onConflictDoUpdate({
				target: accountStanding.userId,
				set: {
					behaviourScore: score,
					scoredAt: new Date(now),
					...(restrict && { restricted: true, restrictedBy: 'score' as const }),
				},
				setWhere: ne(accountStanding.role, 'moderator'),
			})
		if (!restrict) continue
		restricted += 1
		await db.insert(moderationAction).values({
			action: 'restrict',
			reason: 'spam',
			targetKind: 'account',
			targetId: user_id,
			targetUserId: user_id,
			note: `Behaviour score ${score}`,
		})
		await raise_case(
			db,
			{ kind: 'profile', id: user_id, user_id },
			{ reason: 'spam', weight: 20, flags: { score, signals: found } },
		)
	}
	return { scored: ids.length, restricted }
}

/** A moderator restricts or frees an account. Freeing also clears a score's restriction. */
export async function set_restricted(
	db: Db,
	moderator_id: string,
	user_id: string,
	restricted: boolean,
) {
	await db.batch([
		db
			.insert(accountStanding)
			.values({ userId: user_id, restricted, restrictedBy: restricted ? 'moderator' : null })
			.onConflictDoUpdate({
				target: accountStanding.userId,
				set: { restricted, restrictedBy: restricted ? 'moderator' : null },
				setWhere: ne(accountStanding.role, 'moderator'),
			}),
		db.insert(moderationAction).values({
			moderatorId: moderator_id,
			action: restricted ? 'restrict' : 'unrestrict',
			targetKind: 'account',
			targetId: user_id,
			targetUserId: user_id,
		}),
	])
}
