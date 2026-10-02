import { describe, expect, it } from 'vitest'
import { guard_input, is_english, neurons, parse_guard, parse_vision, TEXT_INPUT_MAX } from './ai'

describe('parse_guard', () => {
	it('reads the plain-text answer', () => {
		expect(parse_guard('safe')).toEqual({ safe: true, categories: [] })
		expect(parse_guard('\nunsafe\nS1,S10')).toEqual({ safe: false, categories: ['S1', 'S10'] })
		expect(parse_guard('unsafe\nS12')).toEqual({ safe: false, categories: ['S12'] })
	})

	it('reads the parsed answer', () => {
		expect(parse_guard({ safe: false, categories: ['S4', 'S99'] })).toEqual({
			safe: false,
			categories: ['S4'],
		})
		expect(parse_guard({ safe: true, categories: ['S1'] })).toEqual({ safe: true, categories: [] })
	})

	it('refuses anything else instead of guessing', () => {
		expect(parse_guard('I cannot help with that')).toBeUndefined()
		expect(parse_guard({ categories: [] })).toBeUndefined()
		expect(parse_guard(undefined)).toBeUndefined()
		expect(parse_guard(42)).toBeUndefined()
	})
})

describe('guard_input', () => {
	it('caps the text it sends', () => {
		const input = guard_input('a'.repeat(TEXT_INPUT_MAX + 500))
		expect(input.messages[0].content).toHaveLength(TEXT_INPUT_MAX)
	})
})

describe('is_english', () => {
	it('takes Latin-script text', () => {
		expect(is_english('See you after class, bring the notes')).toBe(true)
		expect(is_english('Café time 🎉')).toBe(true)
	})

	it('skips Japanese, Khmer and mixed text that is mostly not Latin', () => {
		expect(is_english('今日はいい天気ですね')).toBe(false)
		expect(is_english('សួស្តី អ្នកសុខសប្បាយទេ')).toBe(false)
		expect(is_english('OK 今日はいい天気ですね本当に')).toBe(false)
	})

	it('skips text with nothing to read', () => {
		expect(is_english('🎉🎉🎉 123')).toBe(false)
		expect(is_english('ok')).toBe(false)
	})
})

describe('parse_vision', () => {
	it('reads JSON inside the answer', () => {
		expect(parse_vision('Sure: {"nudity":0,"violence":2,"gore":1}')).toEqual({
			nudity: 0,
			violence: 2,
			gore: 1,
		})
		expect(parse_vision({ nudity: 3, violence: 0, gore: 0 })).toEqual({
			nudity: 3,
			violence: 0,
			gore: 0,
		})
	})

	it('refuses missing or out-of-range scores', () => {
		expect(parse_vision('{"nudity":4,"violence":0,"gore":0}')).toBeUndefined()
		expect(parse_vision('{"nudity":1,"violence":0}')).toBeUndefined()
		expect(parse_vision('no idea')).toBeUndefined()
		expect(parse_vision('{"nudity":')).toBeUndefined()
	})
})

describe('neurons', () => {
	it('converts tokens at the published rates', () => {
		// 1M input tokens of Llama Guard is $0.484, which is 44,000 neurons.
		expect(neurons('text', { prompt_tokens: 1_000_000 })).toBe(44_000)
		expect(neurons('text', { prompt_tokens: 400, completion_tokens: 3 })).toBe(18)
		expect(neurons('text', undefined)).toBe(0)
	})
})
