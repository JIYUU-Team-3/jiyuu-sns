import { and, eq, sql } from 'drizzle-orm'
import type { getDb } from './db'
import { follow, followRequest, profile } from './db/schema'
import { notify, retract } from './notifications'
import { blocked_between } from './safety'

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
