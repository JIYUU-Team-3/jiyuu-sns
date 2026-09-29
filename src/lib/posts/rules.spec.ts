import { describe, expect, it } from 'vitest'
import {
	counter_state,
	draft_problem,
	MEDIA_MAX,
	POST_MAX,
	post_length,
	post_problem,
	split_at_limit,
} from './rules'

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

describe('draft_problem', () => {
	it('lets photos stand in for text', () => {
		expect(draft_problem({ body: '', media: [] })).toBe('empty')
		expect(draft_problem({ body: '', media: [{}] })).toBeUndefined()
	})

	it('caps photos at six', () => {
		expect(draft_problem({ body: 'x', media: Array(MEDIA_MAX + 1).fill({}) })).toBe(
			'too_much_media',
		)
	})

	it('refuses the same photo, GIF or video twice', () => {
		const gif = { url: 'https://media.example/a.gif' }
		expect(draft_problem({ body: '', media: [gif, { ...gif }] })).toBe('duplicate_media')
		expect(
			draft_problem({ body: '', media: [gif, { url: 'https://media.example/b.gif' }] }),
		).toBeUndefined()
	})

	it('ignores uploads that have no URL yet', () => {
		expect(draft_problem({ body: '', media: [{}, {}] })).toBeUndefined()
	})

	it('needs a question and two filled choices for a poll, and no photos', () => {
		const poll = { options: ['a', ' ', 'b'] }
		expect(draft_problem({ body: 'q?', media: [], poll })).toBeUndefined()
		expect(draft_problem({ body: '', media: [], poll })).toBe('poll_question')
		expect(draft_problem({ body: 'q?', media: [], poll: { options: ['a', ''] } })).toBe(
			'poll_options',
		)
		expect(draft_problem({ body: 'q?', media: [{}], poll })).toBe('poll_media')
	})
})
