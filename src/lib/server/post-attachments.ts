import { error } from '@sveltejs/kit'
import type { Media } from '#lib/posts/types'
import { is_gif_url } from './gifs'
import { is_own_post_upload, is_post_file_url, is_video_url, media_key } from './media'

/** Verify the storage kind and ownership before accepting attachments from a browser. */
export async function checked_post_media(bucket: R2Bucket, user_id: string, media: Media[]) {
	return Promise.all(
		media.map(async (item) => {
			if (item.kind === 'gif') {
				if (!is_gif_url(item.url)) error(400, 'Invalid media.')
				return item
			}
			if (
				!is_own_post_upload(item.url, user_id) ||
				is_video_url(item.url) !== (item.kind === 'video') ||
				is_post_file_url(item.url) !== (item.kind === 'file')
			)
				error(400, 'Invalid media.')
			if (item.kind !== 'file') return item
			const object = await bucket.head(media_key(item.url)!)
			if (
				!object ||
				!object.customMetadata?.name ||
				object.size !== item.size ||
				object.customMetadata.name !== item.name
			)
				error(400, 'Invalid file.')
			return { ...item, name: object.customMetadata.name, size: object.size }
		}),
	)
}
