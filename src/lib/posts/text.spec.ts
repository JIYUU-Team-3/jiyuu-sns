import { describe, expect, it } from 'vitest'
import { text_segments } from './text'

describe('text_segments', () => {
	it('leaves plain text alone', () => {
		expect(text_segments('hello @mika')).toEqual([{ text: 'hello @mika' }])
	})

	it('picks out hashtags', () => {
		expect(text_segments('hi #svelte and #web_dev!')).toEqual([
			{ text: 'hi ' },
			{ text: '#svelte', tag: 'svelte' },
			{ text: ' and ' },
			{ text: '#web_dev', tag: 'web_dev' },
			{ text: '!' },
		])
	})

	it('reads hashtags in Japanese and Khmer, combining marks included', () => {
		expect(text_segments('#日本語 ok')[0]).toEqual({ text: '#日本語', tag: '日本語' })
		expect(text_segments('#ភាសាខ្មែរ')).toEqual([{ text: '#ភាសាខ្មែរ', tag: 'ភាសាខ្មែរ' }])
	})

	it('skips numbers, a # inside a word, and doubled #', () => {
		expect(text_segments('#1 a#b ##x')).toEqual([{ text: '#1 a#b ##x' }])
	})

	it('keeps a URL fragment inside the link', () => {
		expect(text_segments('https://a.io/#top')).toEqual([
			{ text: 'a.io/#top', href: 'https://a.io/#top' },
		])
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
