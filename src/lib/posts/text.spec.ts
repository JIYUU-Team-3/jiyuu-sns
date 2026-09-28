import { describe, expect, it } from 'vitest'
import { text_segments } from './text'

describe('text_segments', () => {
	it('leaves plain text alone', () => {
		expect(text_segments('hello #svelte @mika')).toEqual([{ text: 'hello #svelte @mika' }])
	})

	it('links URLs and shows them without the scheme', () => {
		expect(text_segments('see https://svelte.dev/docs now')).toEqual([
			{ text: 'see ' },
			{ text: 'svelte.dev/docs', href: 'https://svelte.dev/docs' },
			{ text: ' now' },
		])
	})

	it('leaves sentence punctuation outside the link', () => {
		expect(text_segments('Read http://a.io/x.')).toEqual([
			{ text: 'Read ' },
			{ text: 'a.io/x', href: 'http://a.io/x' },
			{ text: '.' },
		])
	})

	it('does not link other schemes', () => {
		expect(text_segments('javascript:alert(1)')).toEqual([{ text: 'javascript:alert(1)' }])
	})
})
