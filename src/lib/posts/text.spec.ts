import { describe, expect, it } from 'vitest'
import { extract_mentions, extract_tags, text_segments } from './text'

describe('text_segments', () => {
	it('leaves plain text alone', () => {
		expect(text_segments('hello there')).toEqual([{ text: 'hello there' }])
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

	it('finds hashtags and mentions', () => {
		expect(text_segments('hello #Svelte @Mika!')).toEqual([
			{ text: 'hello ' },
			{ text: '#Svelte', tag: 'svelte' },
			{ text: ' ' },
			{ text: '@Mika', handle: 'mika' },
			{ text: '!' },
		])
	})

	it('keeps a # or @ inside a link part of the link', () => {
		expect(text_segments('https://a.io/#top and https://a.io/@me')).toEqual([
			{ text: 'a.io/#top', href: 'https://a.io/#top' },
			{ text: ' and ' },
			{ text: 'a.io/@me', href: 'https://a.io/@me' },
		])
	})

	it('ignores email addresses, words with a # inside and number-only tags', () => {
		expect(text_segments('mail a@b.com, C# or #1')).toEqual([{ text: 'mail a@b.com, C# or #1' }])
	})

	it('drops a trailing full stop from a mention', () => {
		expect(text_segments('thanks @sora.')).toEqual([
			{ text: 'thanks ' },
			{ text: '@sora', handle: 'sora' },
			{ text: '.' },
		])
	})

	it('ignores handles that are too short or too long', () => {
		expect(text_segments('@ab @abcdefghijklmnopqrstu')).toEqual([
			{ text: '@ab @abcdefghijklmnopqrstu' },
		])
	})

	it('reads Japanese and Khmer tags, and normalises full-width letters', () => {
		expect(extract_tags('#日本語 #កម្ពុជា #ＳＶＥＬＴＥ')).toEqual(['日本語', 'កម្ពុជា', 'svelte'])
	})

	it('ends a tag at punctuation', () => {
		expect(text_segments('#webdev, yes')).toEqual([
			{ text: '#webdev', tag: 'webdev' },
			{ text: ', yes' },
		])
	})

	it('picks out tags with underscores and Khmer combining marks', () => {
		expect(text_segments('hi #svelte and #web_dev!')).toEqual([
			{ text: 'hi ' },
			{ text: '#svelte', tag: 'svelte' },
			{ text: ' and ' },
			{ text: '#web_dev', tag: 'web_dev' },
			{ text: '!' },
		])
		expect(text_segments('#ភាសាខ្មែរ')).toEqual([{ text: '#ភាសាខ្មែរ', tag: 'ភាសាខ្មែរ' }])
	})

	it('skips numbers, a # inside a word, and a doubled #', () => {
		expect(text_segments('#1 a#b ##x')).toEqual([{ text: '#1 a#b ##x' }])
	})

	it('reads the full-width ＃ that Japanese keyboards type', () => {
		expect(text_segments('今日は ＃ラーメン')).toEqual([
			{ text: '今日は ' },
			{ text: '＃ラーメン', tag: 'ラーメン' },
		])
		expect(text_segments('今日は＃ラーメン')).toEqual([{ text: '今日は＃ラーメン' }])
	})
})

describe('links that hide their host', () => {
	it('leaves a URL with user info as plain text', () => {
		const segments = text_segments('see https://bank.example@evil.example/login now')
		expect(segments.some((segment) => segment.href)).toBe(false)
		expect(segments.map((segment) => segment.text).join('')).toBe(
			'see https://bank.example@evil.example/login now',
		)
	})

	it('still links a URL with an @ in its path', () => {
		const [link] = text_segments('https://social.example/@mika')
		expect(link.href).toBe('https://social.example/@mika')
	})
})

describe('extract_tags and extract_mentions', () => {
	it('returns each one once', () => {
		expect(extract_tags('#a1 #A1 #b2')).toEqual(['a1', 'b2'])
		expect(extract_mentions('@sora @Sora @mika')).toEqual(['sora', 'mika'])
	})
})
