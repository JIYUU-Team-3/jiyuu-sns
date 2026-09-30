import { describe, expect, it } from 'vitest'
import { complete, highlight_runs, typing_at } from './compose'
import { accent_ranges } from './text'

describe('typing_at', () => {
	it('finds the mention being typed', () => {
		expect(typing_at('hi @mi', 6)).toEqual({ kind: '@', query: 'mi', start: 3, end: 6 })
	})

	it('takes in the rest of the word when the caret is inside it', () => {
		expect(typing_at('hi @mika there', 6)).toEqual({ kind: '@', query: 'mi', start: 3, end: 8 })
	})

	it('finds a hashtag, including Japanese', () => {
		expect(typing_at('今日は #日本', 7)).toEqual({ kind: '#', query: '日本', start: 4, end: 7 })
	})

	it('waits for at least one letter', () => {
		expect(typing_at('hi @', 4)).toBeUndefined()
		expect(typing_at('hi #', 4)).toBeUndefined()
	})

	it('ignores email addresses, words and links', () => {
		expect(typing_at('mail a@b', 8)).toBeUndefined()
		expect(typing_at('C#dev', 5)).toBeUndefined()
		expect(typing_at('see a.io/#top', 13)).toBeUndefined()
	})

	it('stops at a space', () => {
		expect(typing_at('@mika done', 10)).toBeUndefined()
	})
})

describe('complete', () => {
	it('fills in the handle and adds a space', () => {
		const typing = typing_at('hi @mi', 6)!
		expect(complete('hi @mi', typing, 'mika_t')).toEqual({ text: 'hi @mika_t ', caret: 11 })
	})

	it('replaces the whole word and reuses a following space', () => {
		const typing = typing_at('hi @mix there', 5)!
		expect(complete('hi @mix there', typing, 'mika')).toEqual({ text: 'hi @mika there', caret: 9 })
	})

	it('fills in a tag', () => {
		const typing = typing_at('#sve', 4)!
		expect(complete('#sve', typing, 'sveltekit')).toEqual({ text: '#sveltekit ', caret: 11 })
	})
})

describe('highlight_runs', () => {
	it('marks links, tags and mentions', () => {
		const text = 'hi @mika #tag'
		const runs = highlight_runs(text, 280, accent_ranges(text))
		expect(runs.map((run) => [run.text, run.accent])).toEqual([
			['hi ', false],
			['@mika', true],
			[' ', false],
			['#tag', true],
		])
	})

	it('cuts at the length limit and at extra points', () => {
		const runs = highlight_runs('abcdef', 4, [[1, 3]], [5])
		expect(runs.map((run) => [run.text, run.start, run.accent, run.over])).toEqual([
			['a', 0, false, false],
			['bc', 1, true, false],
			['d', 3, false, false],
			['e', 4, false, true],
			['f', 5, false, true],
		])
	})

	it('handles an empty draft', () => {
		expect(highlight_runs('', 280, [])).toEqual([])
	})
})
