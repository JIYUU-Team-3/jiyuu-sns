import { eq } from 'drizzle-orm'
import type { getDb } from './db'
import { profile } from './db/schema'

type Db = ReturnType<typeof getDb>

export async function find_profile(db: Db, user_id: string) {
	const [row] = await db.select().from(profile).where(eq(profile.userId, user_id)).limit(1)
	return row
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

	const row = {
		handle: values.handle,
		displayName: values.name,
		bio: values.bio,
		avatarUrl: values.image ?? null,
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
