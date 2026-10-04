import { eq, inArray, sql } from 'drizzle-orm'
import { shown_birthday } from '#lib/profiles/details'
import type { ProfileDetails } from '#lib/profiles/form/profile'
import type { ProfileView } from '#lib/profiles/types'
import { shown_image } from './account-image'
import { is_moderator } from './moderation/standing'
import { is_verified } from './verified'
import type { getDb } from './db'
import { profile, user } from './db/schema'

type Db = ReturnType<typeof getDb>

export async function find_profile(db: Db, user_id: string) {
	const [row] = await db.select().from(profile).where(eq(profile.userId, user_id)).limit(1)
	return row
}

/**
 * A public profile by handle, with its counts and the viewer's follow state, in one D1 round
 * trip. The join date is the account's, so it doesn't move if onboarding is finished later.
 */
export async function find_profile_by_handle(
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
			location: profile.location,
			birth_date: profile.birthDate,
			birthday_audience: profile.birthdayAudience,
			birth_year_audience: profile.birthYearAudience,
			image: shown_image,
			banner: profile.bannerUrl,
			moderator: is_moderator(profile.userId),
			verified: is_verified(profile.userId),
			joined: sql<number>`${user.createdAt}`,
			posts: sql<number>`(select count(*) from post p where p.author_id = ${profile.userId} and p.is_reply = 0 and p.moderation = 'visible')`,
			followers: sql<number>`(select count(*) from follow f where f.following_id = ${profile.userId})`,
			following: sql<number>`(select count(*) from follow f where f.follower_id = ${profile.userId})`,
			followed: viewer
				? sql<number>`exists(select 1 from follow f where f.follower_id = ${viewer} and f.following_id = ${profile.userId})`
				: sql<number>`0`,
			follows_you: viewer
				? sql<number>`exists(select 1 from follow f where f.follower_id = ${profile.userId} and f.following_id = ${viewer})`
				: sql<number>`0`,
			private: profile.isPrivate,
			requested: viewer
				? sql<number>`exists(select 1 from follow_request r where r.requester_id = ${viewer} and r.target_id = ${profile.userId})`
				: sql<number>`0`,
			blocked: viewer
				? sql<number>`exists(select 1 from block b where b.blocker_id = ${viewer} and b.blocked_id = ${profile.userId})`
				: sql<number>`0`,
			blocks_you: viewer
				? sql<number>`exists(select 1 from block b where b.blocker_id = ${profile.userId} and b.blocked_id = ${viewer})`
				: sql<number>`0`,
			muted: viewer
				? sql<number>`exists(select 1 from mute m where m.muter_id = ${viewer} and m.muted_id = ${profile.userId})`
				: sql<number>`0`,
		})
		.from(profile)
		.innerJoin(user, eq(user.id, profile.userId))
		.where(eq(profile.handle, handle))
		.limit(1)
	if (!row) return undefined
	const { birth_date, birthday_audience, birth_year_audience, ...shown } = row
	const mine = row.id === viewer
	return {
		...shown,
		location: row.location || undefined,
		// Only the parts this viewer may see ever leave the server.
		birthday: shown_birthday(
			birth_date,
			{ day: birthday_audience, year: birth_year_audience },
			{ mine, follower: !!row.followed },
		),
		image: row.image ?? undefined,
		banner: row.banner ?? undefined,
		moderator: row.moderator ? true : undefined,
		verified: row.verified ? true : undefined,
		followed: !!row.followed,
		follows_you: !!row.follows_you,
		requested: !!row.requested,
		blocked: !!row.blocked,
		blocks_you: !!row.blocks_you,
		muted: !!row.muted,
		mine,
	}
}

/** The name and photo of each profile in `handles`, at most 20; handles nobody holds are left out. */
export async function profile_cards(db: Db, handles: string[]) {
	const rows = await db
		.select({ handle: profile.handle, name: profile.displayName, image: shown_image })
		.from(profile)
		.innerJoin(user, eq(user.id, profile.userId))
		.where(inArray(profile.handle, handles.slice(0, 20)))
	return rows.map((row) => ({ ...row, image: row.image ?? undefined }))
}

/** Whether another account already holds `handle`. */
export async function handle_taken(db: Db, user_id: string, handle: string) {
	const [holder] = await db
		.select({ user_id: profile.userId })
		.from(profile)
		.where(eq(profile.handle, handle))
		.limit(1)
	return !!holder && holder.user_id !== user_id
}

/**
 * Create or update the account's profile. Returns 'taken' when another account holds the
 * handle; the unique index decides, so two people racing for one handle can't both win.
 * `avatar` and `banner` are new upload URLs, or null to clear one; leaving one out keeps what's
 * stored.
 */
export async function save_profile(
	db: Db,
	user_id: string,
	values: {
		handle: string
		name: string
		bio: string
		/** Location and birthday; left out, they keep what's saved. */
		details?: ProfileDetails
		avatar?: string | null
		banner?: string | null
	},
): Promise<'saved' | 'taken'> {
	if (await handle_taken(db, user_id, values.handle)) return 'taken'

	// Leaving `avatar` or `banner` out keeps the saved image, so editing text never clears it.
	const row = {
		handle: values.handle,
		displayName: values.name,
		bio: values.bio,
		...(values.details && {
			location: values.details.location,
			birthDate: values.details.birth_date,
			birthdayAudience: values.details.birthday_audience,
			birthYearAudience: values.details.birth_year_audience,
		}),
		...(values.avatar !== undefined && { avatarUrl: values.avatar }),
		...(values.banner !== undefined && { bannerUrl: values.banner }),
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
