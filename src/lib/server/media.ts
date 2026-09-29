import type { ImageUpload } from '#lib/media'

/** Uploads are stored as `/media/<key>` URLs, served by `src/routes/media/[...key]`. */
const PREFIX = '/media/'

/** Keys this app writes: `avatars/<user>/<uuid>.<ext>` or `banners/…`. */
const KEY_PATTERN = /^(avatars|banners)\/[\w-]+\/[\w-]+\.(jpg|png|gif|webp)$/

export const is_media_key = (key: string) => KEY_PATTERN.test(key)

/** The R2 key behind one of our URLs; undefined for anything else, such as a Google photo. */
export function media_key(url: string | null | undefined): string | undefined {
	if (!url?.startsWith(PREFIX)) return undefined
	const key = url.slice(PREFIX.length)
	return is_media_key(key) ? key : undefined
}

/** Store an upload under a fresh key, so its URL never changes content and can cache forever. */
export async function put_image(bucket: R2Bucket, user_id: string, upload: ImageUpload) {
	const key = `${upload.kind}s/${user_id}/${crypto.randomUUID()}.${upload.ext}`
	await bucket.put(key, upload.bytes, { httpMetadata: { contentType: upload.type } })
	return PREFIX + key
}

/** Delete whichever of `urls` are our uploads; other URLs are skipped. */
export async function delete_media(bucket: R2Bucket, urls: (string | null | undefined)[]) {
	const keys = urls.map(media_key).filter((key): key is string => !!key)
	if (keys.length) await bucket.delete(keys)
}
