import { describe, expect, it } from 'vitest'
import {
	delete_media,
	is_video_url,
	media_key,
	is_own_message_upload,
	put_message_file,
} from './media'

const KEY = 'avatars/user_1/0b0e6c1e-5f7a-4c4e-9c1a-2d7f0f7f1a11.png'

describe('media_key', () => {
	it('reads the key from our URLs only', () => {
		expect(media_key(`/media/${KEY}`)).toBe(KEY)
		expect(media_key('https://lh3.googleusercontent.com/a/photo')).toBeUndefined()
		expect(media_key(null)).toBeUndefined()
	})

	it('refuses keys this app never writes', () => {
		expect(media_key('/media/avatars/../secrets.png')).toBeUndefined()
		expect(media_key('/media/other/u/x.png')).toBeUndefined()
	})

	it('allows videos only on posts', () => {
		expect(media_key('/media/posts/u/v-1.mp4')).toBe('posts/u/v-1.mp4')
		expect(media_key('/media/avatars/u/v-1.mp4')).toBeUndefined()
	})

	it('recognizes private file keys without allowing arbitrary extensions or paths', () => {
		expect(media_key('/media/messages/alice/file-1.bin')).toBe('messages/alice/file-1.bin')
		expect(is_own_message_upload('/media/messages/alice/file-1.bin', 'alice')).toBe(true)
		expect(is_own_message_upload('/media/messages/alice/file-1.bin', 'bob')).toBe(false)
		expect(media_key('/media/messages/alice/file.html')).toBeUndefined()
		expect(media_key('/media/messages/alice/../file.bin')).toBeUndefined()
	})
})

describe('put_message_file', () => {
	it('stores arbitrary bytes as downloads with a separate Unicode filename', async () => {
		let saved: { key: string; body: ArrayBuffer; options: R2PutOptions } | undefined
		const bucket = {
			put: async (key: string, body: ArrayBuffer, options: R2PutOptions) => {
				saved = { key, body, options }
			},
		} as unknown as R2Bucket
		const content = '<script>alert(1)</script>'
		const url = await put_message_file(bucket, 'alice', new File([content], '資料.html'))
		expect(url).toMatch(/^\/media\/messages\/alice\/[\w-]+\.bin$/)
		expect(saved?.options.httpMetadata).toEqual({
			contentType: 'application/octet-stream',
			contentDisposition: `attachment; filename="file"; filename*=UTF-8''${encodeURIComponent('資料.html')}`,
		})
		expect(saved?.options.customMetadata).toEqual({ name: '資料.html' })
		expect(await new Response(saved?.body).text()).toBe(content)
	})
})

describe('is_video_url', () => {
	it('tells our post videos from photos and outside URLs', () => {
		expect(is_video_url('/media/posts/u/v.mp4')).toBe(true)
		expect(is_video_url('/media/posts/u/p.jpg')).toBe(false)
		expect(is_video_url('https://example.com/v.mp4')).toBe(false)
	})
})

describe('delete_media', () => {
	it('deletes only our uploads, and skips the call when there are none', async () => {
		const deleted: string[][] = []
		const bucket = {
			delete: async (keys: string[]) => void deleted.push(keys),
		} as unknown as R2Bucket
		await delete_media(bucket, [`/media/${KEY}`, 'https://example.com/a.png', undefined])
		await delete_media(bucket, [null])
		expect(deleted).toEqual([[KEY]])
	})
})
