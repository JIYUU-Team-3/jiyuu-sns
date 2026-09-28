import { and, eq, sql } from 'drizzle-orm'
import type { getDb } from './db'
import { follow, profile } from './db/schema'

type Db = ReturnType<typeof getDb>

export async function set_follow(db: Db, follower_id: string, handle: string, on: boolean) {
	if (on) {
		await db.run(
			sql`insert or ignore into follow (follower_id, following_id) select ${follower_id}, user_id from profile where handle = ${handle} and user_id != ${follower_id}`,
		)
	} else {
		await db
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
	}
}
