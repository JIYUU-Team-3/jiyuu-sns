import { eq } from 'drizzle-orm'
import type { getDb } from '../db'
import { blockedMediaHash, moderationAction } from '../db/schema'
import { media_key } from '../media'

type Db = ReturnType<typeof getDb>

/** Hex SHA-256 of the bytes as stored, after metadata stripping. */
export async function sha256(bytes: BufferSource) {
	const digest = await crypto.subtle.digest('SHA-256', bytes)
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** Whether a moderator removed these exact bytes before. */
export async function is_blocked_media(db: Db, bytes: BufferSource) {
	const [row] = await db
		.select({ sha256: blockedMediaHash.sha256 })
		.from(blockedMediaHash)
		.where(eq(blockedMediaHash.sha256, await sha256(bytes)))
		.limit(1)
	return !!row
}

/**
 * Put one of our uploaded images on the blocklist, so the same file is refused wherever it's
 * uploaded again. Returns false for anything that isn't a stored image.
 */
export async function block_media(db: Db, bucket: R2Bucket, url: string, moderator_id: string) {
	const key = media_key(url)
	if (!key || key.endsWith('.mp4')) return false
	const object = await bucket.get(key)
	if (!object) return false
	const hash = await sha256(await object.arrayBuffer())
	await db.batch([
		db
			.insert(blockedMediaHash)
			.values({ sha256: hash, addedBy: moderator_id })
			.onConflictDoNothing(),
		db.insert(moderationAction).values({
			moderatorId: moderator_id,
			action: 'block_media',
			targetKind: 'media',
			targetId: hash,
		}),
	])
	return true
}
