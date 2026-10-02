import { describe, expect, it } from 'vitest'
import { MESSAGE_FILE_MAX_BYTES, file_size, message_file_kind, message_file_name } from './files'

describe('DM files', () => {
	it('previews raster images by their bytes and accepts other types as downloads', async () => {
		const png = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], 'photo.txt')
		expect(await message_file_kind(png)).toBe('image')
		for (const file of [
			new File(['<svg onload="alert(1)"></svg>'], 'picture.svg', { type: 'image/svg+xml' }),
			new File(['<html>content</html>'], 'page.html', { type: 'text/html' }),
			new File(['%PDF-1.7'], 'notes.pdf', { type: 'application/pdf' }),
			new File([], 'empty.txt'),
		])
			expect(await message_file_kind(file)).toBe('file')
	})

	it('keeps Unicode filenames while removing paths and control characters', () => {
		expect(message_file_name('C:\\folder\\資料\r\n.pdf')).toBe('資料.pdf')
		expect(message_file_name('../../notes.pdf')).toBe('notes.pdf')
		expect(message_file_name('notes\u202e\u2066.pdf')).toBe('notes.pdf')
		expect(message_file_name('')).toBe('file')
		expect(message_file_name('x'.repeat(300))).toHaveLength(255)
	})

	it('uses the existing 5 MB cap and displays sizes including empty files', () => {
		expect(MESSAGE_FILE_MAX_BYTES).toBe(5 * 1024 * 1024)
		expect(file_size(0)).toBe('0 B')
		expect(file_size(2048)).toBe('2 KB')
		expect(file_size(1024 * 1024)).toBe('1.0 MB')
	})
})
