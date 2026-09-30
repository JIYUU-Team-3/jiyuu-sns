import { and, eq, sql } from 'drizzle-orm'
import type { getDb } from './db'
import { follow, profile } from './db/schema'
import { notify, retract } from './notifications'

type Db = ReturnType<typeof getDb>

export async function set_follow(db: Db, follower_id: string, handle: string, on: boolean) {
	if (on) {
		// Only a follow that is actually new is announced; a repeated one inserts nothing.
		const added = await db.all<{ following_id: string }>(
			sql`insert or ignore into follow (follower_id, following_id) select ${follower_id}, user_id from profile where handle = ${handle} and user_id != ${follower_id} returning following_id`,
		)
		await notify(
			db,
			added.map((row) => ({ user_id: row.following_id, actor_id: follower_id, type: 'follow' })),
		)
	} else {
		const removed = await db
			.delete(follow)
			.where(
				and(
					eq(follow.followerId, follower_id),
					eq(
						follow.followingId,
						db.select({ id: profile.userId }).from(profile).where(eq(profile.handle, handle)),
					),
				),
			)
			.returning({ following_id: follow.followingId })
		for (const row of removed) {
			await retract(db, { user_id: row.following_id, actor_id: follower_id, type: 'follow' })
		}
	}
}
