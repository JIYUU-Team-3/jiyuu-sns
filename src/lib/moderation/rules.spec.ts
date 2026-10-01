import { describe, expect, it } from 'vitest'
import { is_rule, is_severe, strike_outcome } from './rules'

describe('strike_outcome', () => {
	it('warns on the first strikes', () => {
		expect(strike_outcome('spam', 1, 1)).toEqual({ kind: 'warning' })
		expect(strike_outcome('hate', 2, 4)).toEqual({ kind: 'warning' })
	})

	it('suspends for a week at three strikes inside the window', () => {
		expect(strike_outcome('spam', 3, 3)).toEqual({ kind: 'suspend', days: 7 })
	})

	it('bans at five strikes in all, or at once for a never-allowed rule', () => {
		expect(strike_outcome('spam', 1, 5)).toEqual({ kind: 'ban' })
		expect(strike_outcome('threat', 1, 1)).toEqual({ kind: 'ban' })
		expect(strike_outcome('child_safety', 1, 1)).toEqual({ kind: 'ban' })
	})
})

describe('rules', () => {
	it('knows its own names and nothing else', () => {
		expect(is_rule('harassment')).toBe(true)
		expect(is_rule('toString')).toBe(false)
		expect(is_rule(undefined)).toBe(false)
	})

	it('marks the never-allowed rules as severe', () => {
		expect(is_severe('doxxing')).toBe(true)
		expect(is_severe('copyright')).toBe(false)
	})
})
