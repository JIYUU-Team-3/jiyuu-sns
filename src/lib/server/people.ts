import { eq, sql } from 'drizzle-orm'
import type { UserView } from '#lib/search/types'
import { shown_image } from './account-image'
import { is_moderator } from './moderation/standing'
import type { getDb } from './db'
import { profile, user } from './db/schema'

type Db = ReturnType<typeof getDb>

/** What a list of people shows of each account, with the viewer's follow state. */
export const user_fields = (viewer: string | undefined) => ({
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

/** Accounts with their profiles, for the caller to filter and order. */
export function select_users(db: Db, viewer: string | undefined) {
	return db
		.select(user_fields(viewer))
		.from(profile)
		.innerJoin(user, eq(user.id, profile.userId))
		.$dynamic()
}

type UserRow = Awaited<ReturnType<ReturnType<typeof select_users>['execute']>>[number]

export const to_user = (row: UserRow, viewer: string | undefined): UserView => ({
	...row,
	location: row.location || undefined,
	image: row.image ?? undefined,
	moderator: row.moderator ? true : undefined,
	followed: !!row.followed,
	requested: !!row.requested,
	mine: row.id === viewer,
})
