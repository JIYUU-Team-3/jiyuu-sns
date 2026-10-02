import { describe, expect, it } from 'vitest'
import { POST_UPLOAD_MAX_BYTES } from '#lib/media'
import { upload_kind, upload_problem } from './upload'

describe('post file uploads', () => {
	it('treats arbitrary and empty files as downloads, even with a forged image type', async () => {
		expect(
			await upload_kind(new File(['<script>alert(1)</script>'], 'file.png', { type: 'image/png' })),
		).toBe('file')
		expect(await upload_problem(new File([], 'empty.txt'))).toBeUndefined()
	})
	it('detects clipboard screenshots from bytes even without a MIME type', async () => {
		const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
		expect(await upload_kind(new File([bytes], 'clipboard'))).toBe('image')
	})
	it('caps arbitrary files at 5 MB rather than allowing the video limit', async () => {
		expect(
			await upload_problem(
				new File([new Uint8Array(POST_UPLOAD_MAX_BYTES.file + 1)], 'file.mp4', {
					type: 'video/mp4',
				}),
			),
		).toBe('size')
	})
})
