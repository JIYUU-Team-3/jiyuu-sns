import { eq, sql } from 'drizzle-orm'
import type { ProfileView } from '#lib/profiles/types'
import type { getDb } from './db'
import { profile, user } from './db/schema'

type Db = ReturnType<typeof getDb>

export async function find_profile(db: Db, user_id: string) {
	const [row] = await db.select().from(profile).where(eq(profile.userId, user_id)).limit(1)
	return row
}

/**
 * A public profile by handle, with its counts, in one D1 round trip. The join date is the
 * account's, so it doesn't move if onboarding is finished later.
 */
export async function find_profile_view(
	db: Db,
	viewer: string | undefined,
	handle: string,
): Promise<ProfileView | undefined> {
	const [row] = await db
		.select({
			id: profile.userId,
			handle: profile.handle,
			name: profile.displayName,
			bio: profile.bio,
			image: sql<string | null>`coalesce(${profile.avatarUrl}, ${user.image})`,
			header: profile.headerUrl,
			joined_at: user.createdAt,
			posts: sql<number>`(select count(*) from post p where p.author_id = ${profile.userId} and p.is_reply = 0)`,
			following: sql<number>`(select count(*) from follow f where f.follower_id = ${profile.userId})`,
			followers: sql<number>`(select count(*) from follow f where f.following_id = ${profile.userId})`,
		})
		.from(profile)
		.innerJoin(user, eq(user.id, profile.userId))
		.where(eq(profile.handle, handle))
		.limit(1)
	if (!row) return undefined
	return {
		...row,
		image: row.image ?? undefined,
		header: row.header ?? undefined,
		joined_at: row.joined_at.getTime(),
		mine: row.id === viewer,
	}
}

/**
 * Create or update the account's profile. Returns 'taken' when another account holds the
 * handle; the unique index decides, so two people racing for one handle can't both win.
 */
export async function save_profile(
	db: Db,
	user_id: string,
	values: { handle: string; name: string; bio: string; image?: string },
): Promise<'saved' | 'taken'> {
	const [holder] = await db
		.select({ user_id: profile.userId })
		.from(profile)
		.where(eq(profile.handle, values.handle))
		.limit(1)
	if (holder && holder.user_id !== user_id) return 'taken'

	// Leaving `image` out keeps the saved photo, so editing text never clears it.
	const row = {
		handle: values.handle,
		displayName: values.name,
		bio: values.bio,
		...(values.image === undefined ? {} : { avatarUrl: values.image }),
	}
	try {
		await db
			.insert(profile)
			.values({ userId: user_id, ...row })
			.onConflictDoUpdate({ target: profile.userId, set: row })
	} catch (error) {
		if (String(error).includes('UNIQUE constraint failed: profile.handle')) return 'taken'
		throw error
	}
	return 'saved'
}
