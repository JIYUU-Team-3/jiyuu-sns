import type { ImageUpload } from '#lib/media'
import { strip_metadata } from './strip-metadata'

/** Uploads are stored as `/media/<key>` URLs, served by `src/routes/media/[...key]`. */
const PREFIX = '/media/'

/** Keys this app writes: `avatars/<user>/<uuid>.<ext>`, `banners/…` or `posts/…` (videos too). */
const KEY_PATTERN =
	/^(?:(?:avatars|banners|posts|messages)\/[\w-]+\/[\w-]+\.(?:jpg|png|gif|webp)|posts\/[\w-]+\/[\w-]+\.mp4)$/

export const is_media_key = (key: string) => KEY_PATTERN.test(key)

/** The URL an R2 key is served at. */
export const media_url = (key: string) => PREFIX + key

/** The R2 key behind one of our URLs; undefined for anything else, such as a Google photo. */
export function media_key(url: string | null | undefined): string | undefined {
	if (!url?.startsWith(PREFIX)) return undefined
	const key = url.slice(PREFIX.length)
	return is_media_key(key) ? key : undefined
}

/**
 * Store an upload under a fresh key, so its URL never changes content and can cache forever.
 * Location, camera details and other metadata are stripped first; a file that can't be cleaned
 * throws `MetadataError` and is never stored, and a file a moderator blocked throws
 * `BlockedMediaError`.
 */
export async function put_image(
	bucket: R2Bucket,
	user_id: string,
	upload: ImageUpload,
	/** Refuses bytes a moderator blocked; see `is_blocked_media`. */
	blocked?: (bytes: ArrayBuffer) => Promise<boolean>,
) {
	const bytes = strip_metadata(upload.bytes, upload.type)
	if (await blocked?.(bytes)) throw new BlockedMediaError()
	const key = fresh_key(`${upload.kind}s`, user_id, upload.ext)
	await bucket.put(key, bytes, { httpMetadata: { contentType: upload.type } })
	return PREFIX + key
}

/** Store a post video, already stripped by `strip_video`, as MP4 (QuickTime plays as one too). */
export async function put_video(bucket: R2Bucket, user_id: string, video: Blob) {
	const key = fresh_key('posts', user_id, 'mp4')
	await bucket.put(key, video, { httpMetadata: { contentType: 'video/mp4' } })
	return PREFIX + key
}

/** The exact image a moderator removed and blocked, uploaded again. */
export class BlockedMediaError extends Error {}

const fresh_key = (folder: string, user_id: string, ext: string) =>
	`${folder}/${user_id}/${crypto.randomUUID()}.${ext}`

/** Delete whichever of `urls` are our uploads; other URLs are skipped. */
export async function delete_media(bucket: R2Bucket, urls: (string | null | undefined)[]) {
	const keys = urls.map(media_key).filter((key): key is string => !!key)
	if (keys.length) await bucket.delete(keys)
}

/** Whether `url` is a post photo or video `user_id` uploaded, so nobody can attach someone else's. */
export function is_own_post_upload(url: string, user_id: string) {
	return !!media_key(url)?.startsWith(`posts/${user_id}/`)
}

/** Whether one of our upload URLs is a video rather than a photo. */
export const is_video_url = (url: string) => !!media_key(url)?.endsWith('.mp4')

export function is_own_message_upload(url: string, user_id: string) {
	return !!media_key(url)?.startsWith(`messages/${user_id}/`)
}

export const is_message_key = (key: string) => key.startsWith('messages/')

export const is_post_key = (key: string) => key.startsWith('posts/')
