import { describe, expect, it } from 'vitest'
import { counter_state, POST_MAX, post_length, post_problem, split_at_limit } from './rules'

describe('post_length', () => {
	it('counts what a reader sees as one character once', () => {
		expect(post_length('hello')).toBe(5)
		expect(post_length('👍🏽')).toBe(1)
		expect(post_length('👨‍👩‍👧')).toBe(1)
		expect(post_length('こんにちは')).toBe(5)
		expect(post_length('ក្រុម')).toBeLessThan('ក្រុម'.length)
	})
})

describe('post_problem', () => {
	it('rejects an empty post', () => {
		expect(post_problem('')).toBe('empty')
	})

	it('accepts exactly the limit and rejects one more', () => {
		expect(post_problem('a'.repeat(POST_MAX))).toBeUndefined()
		expect(post_problem('a'.repeat(POST_MAX + 1))).toBe('too_long')
	})

	it('counts emoji as one each against the limit', () => {
		expect(post_problem('👍🏽'.repeat(POST_MAX))).toBeUndefined()
	})
})

describe('counter_state', () => {
	it('warns in the last 20 characters and flags anything over', () => {
		expect(counter_state(POST_MAX - 20)).toBe('ok')
		expect(counter_state(POST_MAX - 19)).toBe('warn')
		expect(counter_state(POST_MAX)).toBe('warn')
		expect(counter_state(POST_MAX + 1)).toBe('over')
	})
})

describe('split_at_limit', () => {
	it('keeps short text whole', () => {
		expect(split_at_limit('hi')).toEqual(['hi', ''])
	})

	it('splits at the limit on a grapheme boundary', () => {
		const text = '👍🏽'.repeat(POST_MAX) + 'xyz'
		const [kept, overflow] = split_at_limit(text)
		expect(overflow).toBe('xyz')
		expect(post_length(kept)).toBe(POST_MAX)
	})
})
