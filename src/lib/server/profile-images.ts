import { read_image, type ImageKind } from '#lib/media'
import type { getDb } from './db'
import { BlockedMediaError, delete_media, put_image } from './media'
import { is_blocked_media } from './moderation/media'
import { find_profile, handle_taken, save_profile } from './profiles'

type Db = ReturnType<typeof getDb>
type Draft = { handle: string; name: string; bio: string }
type Images = Partial<Record<ImageKind, File>>
type Urls = Partial<Record<ImageKind, string>>
/** The kinds whose stored upload the form asked to drop. */
export type Removals = Partial<Record<ImageKind, boolean>>
/** Per kind: a new upload URL, null to clear it, or left out to keep what's stored. */
export type ImageChanges = Partial<Record<ImageKind, string | null>>

const KINDS = ['avatar', 'banner'] as const

/** Put each picked image in R2 and return the new URLs by kind; a failure leaves nothing behind. */
async function upload_images(
	db: Db,
	bucket: R2Bucket,
	user_id: string,
	images: Images,
): Promise<Urls | { blocked: ImageKind }> {
	const urls: Urls = {}
	let kind: ImageKind | undefined
	try {
		for (kind of KINDS) {
			const file = images[kind]
			if (file) {
				urls[kind] = await put_image(bucket, user_id, await read_image(file, kind), (bytes) =>
					is_blocked_media(db, bytes),
				)
			}
		}
	} catch (error) {
		await delete_media(bucket, Object.values(urls))
		if (error instanceof BlockedMediaError && kind) return { blocked: kind }
		throw error
	}
	return urls
}

/** What to write for each kind: a new upload wins over a removal of the same kind. */
export function image_changes(urls: Urls, removals: Removals): ImageChanges {
	const changes: ImageChanges = {}
	for (const kind of KINDS) {
		if (urls[kind]) changes[kind] = urls[kind]
		else if (removals[kind]) changes[kind] = null
	}
	return changes
}

/** Run `save`, deleting the new uploads when it's refused or fails so R2 keeps no orphans. */
async function save_or_discard(
	bucket: R2Bucket,
	urls: Urls,
	save: () => Promise<'saved' | 'taken'>,
) {
	try {
		const saved = await save()
		if (saved === 'taken') await delete_media(bucket, Object.values(urls))
		return saved
	} catch (error) {
		await delete_media(bucket, Object.values(urls))
		throw error
	}
}

/**
 * Save a profile along with any new or removed avatar and banner; new images must already be
 * checked with `image_errors`. The handle is checked before uploading so a rejected form leaves
 * nothing in R2; replaced or removed uploads are deleted once the save goes through.
 */
export async function save_profile_with_images(
	db: Db,
	bucket: R2Bucket,
	user_id: string,
	draft: Draft,
	images: Images,
	removals: Removals = {},
): Promise<'saved' | 'taken' | { blocked: ImageKind }> {
	if (await handle_taken(db, user_id, draft.handle)) return 'taken'

	const before = await find_profile(db, user_id)
	const urls = await upload_images(db, bucket, user_id, images)
	if ('blocked' in urls) return urls
	const changes = image_changes(urls, removals)
	const saved = await save_or_discard(bucket, urls, () =>
		save_profile(db, user_id, { ...draft, ...changes }),
	)
	if (saved === 'taken') return saved

	const stored = { avatar: before?.avatarUrl, banner: before?.bannerUrl }
	await delete_media(
		bucket,
		KINDS.filter((kind) => kind in changes).map((kind) => stored[kind]),
	)
	return saved
}
