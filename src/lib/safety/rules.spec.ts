import { describe, expect, it } from 'vitest'
import { may_reply, normalize_term } from './rules'

describe('may_reply', () => {
	const nobody = { mine: false, followed_by_author: false, mentioned: false }

	it('lets anyone reply to an open post', () => {
		expect(may_reply('everyone', nobody)).toBe(true)
	})

	it('always lets the author reply', () => {
		expect(may_reply('following', { ...nobody, mine: true })).toBe(true)
		expect(may_reply('mentioned', { ...nobody, mine: true })).toBe(true)
	})

	it('limits replies to people the author follows', () => {
		expect(may_reply('following', nobody)).toBe(false)
		expect(may_reply('following', { ...nobody, followed_by_author: true })).toBe(true)
		expect(may_reply('following', { ...nobody, mentioned: true })).toBe(false)
	})

	it('limits replies to people the post mentions', () => {
		expect(may_reply('mentioned', nobody)).toBe(false)
		expect(may_reply('mentioned', { ...nobody, mentioned: true })).toBe(true)
		expect(may_reply('mentioned', { ...nobody, followed_by_author: true })).toBe(false)
	})
})

describe('normalize_term', () => {
	it('lowercases, folds width and collapses spaces', () => {
		expect(normalize_term('  Spoiler   ALERT ')).toBe('spoiler alert')
		expect(normalize_term('ｓｐｏｉｌｅｒ')).toBe('spoiler')
	})

	it('keeps a hashtag as a tag', () => {
		expect(normalize_term('#Svelte')).toBe('#svelte')
		expect(normalize_term('# svelte')).toBe('#svelte')
	})

	it('refuses terms too short, too long, or a tag with spaces', () => {
		expect(normalize_term('a')).toBeUndefined()
		expect(normalize_term('#a')).toBeUndefined()
		expect(normalize_term('x'.repeat(51))).toBeUndefined()
		expect(normalize_term('#two words')).toBeUndefined()
	})

	it('counts graphemes, so short Japanese words fit', () => {
		expect(normalize_term('ネタバレ')).toBe('ネタバレ')
	})
})
