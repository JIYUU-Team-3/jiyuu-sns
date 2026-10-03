import { and, desc, eq, sql } from 'drizzle-orm'
import type { FollowSide, PeoplePage } from '#lib/profiles/types'
import type { getDb } from './db'
import { follow, followRequest, profile, user } from './db/schema'
import { notify, retract } from './notifications'
import { to_user, user_fields } from './people'
import { older_than, PAGE_SIZE } from './posts'
import { blocked_between, open_to, visible_people } from './safety'

type Db = ReturnType<typeof getDb>

const allowed = (follower_id: string, target_id: string, is_private: boolean) =>
	sql`exists(select 1 from profile where user_id = ${target_id} and is_private = ${is_private ? 1 : 0})
		and not ${blocked_between(follower_id, target_id)}`

export async function set_follow(db: Db, follower_id: string, handle: string, on: boolean) {
	if (on) {
		const [target] = await db
			.select({
				id: profile.userId,
				private: profile.isPrivate,
				blocked: sql<number>`${blocked_between(follower_id, profile.userId)}`,
			})
			.from(profile)
			.where(eq(profile.handle, handle))
			.limit(1)
		if (!target || target.id === follower_id || target.blocked) return
		if (target.private) {
			const asked = await db.all<{ target_id: string }>(
				sql`insert or ignore into follow_request (requester_id, target_id)
					select ${follower_id}, ${target.id}
					where ${allowed(follower_id, target.id, true)}
					and not exists(select 1 from follow where follower_id = ${follower_id} and following_id = ${target.id})
					returning target_id`,
			)
			await notify(
				db,
				asked.map((row) => ({
					user_id: row.target_id,
					actor_id: follower_id,
					type: 'follow_request',
				})),
			)
			return
		}
		// Only a follow that is actually new is announced; a repeated one inserts nothing.
		const added = await db.all<{ following_id: string }>(
			sql`insert or ignore into follow (follower_id, following_id)
				select ${follower_id}, ${target.id}
				where ${allowed(follower_id, target.id, false)}
				returning following_id`,
		)
		await notify(
			db,
			added.map((row) => ({ user_id: row.following_id, actor_id: follower_id, type: 'follow' })),
		)
	} else {
		const target = db.select({ id: profile.userId }).from(profile).where(eq(profile.handle, handle))
		const removed = await db
			.delete(follow)
			.where(and(eq(follow.followerId, follower_id), eq(follow.followingId, target)))
			.returning({ following_id: follow.followingId })
		const withdrawn = await db
			.delete(followRequest)
			.where(and(eq(followRequest.requesterId, follower_id), eq(followRequest.targetId, target)))
			.returning({ target_id: followRequest.targetId })
		for (const row of removed) {
			await retract(db, { user_id: row.following_id, actor_id: follower_id, type: 'follow' })
		}
		for (const row of withdrawn) {
			await retract(db, { user_id: row.target_id, actor_id: follower_id, type: 'follow_request' })
		}
	}
}

/** Whether the viewer may see who `account` follows and who follows it, as they may its posts. */
async function lists_open(db: Db, viewer: string, account: string) {
	const [row] = await db
		.select({ id: profile.userId })
		.from(profile)
		.where(and(eq(profile.userId, account), open_to(viewer, profile.userId, profile.isPrivate)))
		.limit(1)
	return !!row
}

/**
 * One page of the accounts `account` follows, or that follow it, most recently followed first.
 * Empty when the viewer may not see the account, and without anyone blocked either way.
 */
export async function list_follows(
	db: Db,
	viewer: string,
	account: string,
	side: FollowSide,
	cursor: string | undefined,
): Promise<PeoplePage> {
	if (!(await lists_open(db, viewer, account))) return { people: [] }
	const [owner, other] =
		side === 'following'
			? [follow.followerId, follow.followingId]
			: [follow.followingId, follow.followerId]
	const rows = await db
		.select({
			...user_fields(viewer),
			follows_you: sql<number>`exists(select 1 from follow f where f.follower_id = ${profile.userId} and f.following_id = ${viewer})`,
			at: follow.createdAt,
		})
		.from(follow)
		.innerJoin(profile, eq(profile.userId, other))
		.innerJoin(user, eq(user.id, profile.userId))
		.where(
			and(eq(owner, account), visible_people(viewer), older_than(follow.createdAt, other, cursor)),
		)
		.orderBy(desc(follow.createdAt), desc(other))
		.limit(PAGE_SIZE + 1)
	// When someone followed is only the cursor's business; it stays out of what the page returns.
	const people = rows
		.slice(0, PAGE_SIZE)
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		.map(({ at, follows_you, ...row }) => ({ ...to_user(row, viewer), follows_you: !!follows_you }))
	const last = rows[PAGE_SIZE - 1]
	return { people, next: rows.length > PAGE_SIZE ? `${last.at.getTime()}:${last.id}` : undefined }
}

/** Stop `handle` following `me`. Only a follow of `me` can go; returns whether one did. */
export async function remove_follower(db: Db, me: string, handle: string) {
	const them = db.select({ id: profile.userId }).from(profile).where(eq(profile.handle, handle))
	const removed = await db
		.delete(follow)
		.where(and(eq(follow.followingId, me), eq(follow.followerId, them)))
		.returning({ follower_id: follow.followerId })
	for (const row of removed) {
		await retract(db, { user_id: me, actor_id: row.follower_id, type: 'follow' })
	}
	return removed.length > 0
}
