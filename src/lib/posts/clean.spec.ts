import { describe, expect, it } from 'vitest'
import { clean_text } from './clean'

describe('clean_text', () => {
	it('drops bidi overrides and control characters, keeping lines and tabs', () => {
		expect(clean_text('abc\u202edef\u2066x\u2069')).toBe('abcdefx')
		expect(clean_text('one\ntwo\tthree\u0007')).toBe('one\ntwo\tthree')
	})

	it('caps stacked marks without touching real writing', () => {
		const zalgo = 'Z' + '\u0301'.repeat(40) + 'a'
		expect(clean_text(zalgo)).toBe('Z' + '\u0301'.repeat(4) + 'a')
		for (const text of ['ក្រុមហ៊ុន', 'ញ្ញុំ', 'がぎぐ', 'Tiếng Việt', 'e\u0301\u0302', '👩‍👩‍👧']) {
			expect(clean_text(text)).toBe(text)
		}
	})
})
