import type { ImageUpload } from '#lib/media'
import { attachment_name } from '#lib/files'
import { strip_metadata } from './strip-metadata'

/** Uploads are stored as `/media/<key>` URLs, served by `src/routes/media/[...key]`. */
const PREFIX = '/media/'

/** Keys this app writes: `avatars/<user>/<uuid>.<ext>`, `banners/…` or `posts/…` (videos too). */
const KEY_PATTERN =
	/^(?:(?:avatars|banners|posts|messages)\/[\w-]+\/[\w-]+\.(?:jpg|png|gif|webp)|posts\/[\w-]+\/[\w-]+\.mp4|(?:posts|messages)\/[\w-]+\/[\w-]+\.bin)$/

export const is_media_key = (key: string) => KEY_PATTERN.test(key)

/** The R2 key behind one of our URLs; undefined for anything else, such as a Google photo. */
export function media_key(url: string | null | undefined): string | undefined {
	if (!url?.startsWith(PREFIX)) return undefined
	const key = url.slice(PREFIX.length)
	return is_media_key(key) ? key : undefined
}

/**
 * Store an upload under a fresh key, so its URL never changes content and can cache forever.
 * Location, camera details and other metadata are stripped first; a file that can't be cleaned
 * throws `MetadataError` and is never stored.
 */
export async function put_image(bucket: R2Bucket, user_id: string, upload: ImageUpload) {
	const bytes = strip_metadata(upload.bytes, upload.type)
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

/** Arbitrary DM files are downloads, never executable content on our origin. */
export async function put_message_file(bucket: R2Bucket, user_id: string, file: File) {
	return put_file(bucket, 'messages', user_id, file)
}

/** Store general attachments under an opaque key and force them to download. */
export async function put_file(
	bucket: R2Bucket,
	folder: 'posts' | 'messages',
	user_id: string,
	file: File,
) {
	const key = fresh_key(folder, user_id, 'bin')
	const name = attachment_name(file.name)
	await bucket.put(key, await file.arrayBuffer(), {
		httpMetadata: {
			contentType: 'application/octet-stream',
			contentDisposition: `attachment; filename="file"; filename*=UTF-8''${encodeURIComponent(name).replace(/[!'()*]/g, (char) => '%' + char.charCodeAt(0).toString(16))}`,
		},
		customMetadata: { name },
	})
	return PREFIX + key
}

export const is_message_file_url = (url: string) =>
	!!media_key(url)?.startsWith('messages/') && url.endsWith('.bin')

export const is_post_file_url = (url: string) =>
	!!media_key(url)?.startsWith('posts/') && url.endsWith('.bin')

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
