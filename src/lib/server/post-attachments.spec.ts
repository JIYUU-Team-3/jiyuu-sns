import { describe, expect, it, vi } from 'vitest'
import type { Media } from '#lib/posts/types'
import { checked_post_media } from './post-attachments'

const file: Media = {
	kind: 'file',
	url: '/media/posts/alice/document.bin',
	width: 1,
	height: 1,
	name: 'document.html',
	size: 15,
}
const bucket = (object: unknown) =>
	({ head: vi.fn().mockResolvedValue(object) }) as unknown as R2Bucket

describe('post attachments', () => {
	it('accepts an owned file whose metadata matches its stored bytes', async () => {
		expect(
			await checked_post_media(
				bucket({ customMetadata: { name: file.name }, size: file.size }),
				'alice',
				[file],
			),
		).toEqual([file])
	})
	it('refuses forged names, sizes and missing uploads', async () => {
		for (const object of [
			null,
			{ size: 15 },
			{ customMetadata: { name: 'fake.html' }, size: 15 },
			{ customMetadata: { name: file.name }, size: 999 },
		]) {
			await expect(checked_post_media(bucket(object), 'alice', [file])).rejects.toMatchObject({
				status: 400,
			})
		}
	})
	it('refuses another user or a DM upload and prevents inline rendering of file bytes', async () => {
		const storage = bucket({ customMetadata: { name: file.name }, size: file.size })
		for (const item of [
			{ ...file, url: '/media/posts/bob/document.bin' },
			{ ...file, url: '/media/messages/alice/document.bin' },
			{ ...file, kind: 'image' as const },
			{ ...file, url: '/media/posts/alice/photo.png' },
		]) {
			await expect(checked_post_media(storage, 'alice', [item])).rejects.toMatchObject({
				status: 400,
			})
		}
		expect(storage.head).not.toHaveBeenCalled()
	})
})
