import { describe, expect, it } from 'vitest'
import { typo_distance, typo_match } from './fuzzy'

describe('typo_distance', () => {
	it('counts insertions, deletions, substitutions and swapped neighbours as one typo each', () => {
		expect(typo_distance('tanaka', 'tanaka', 2)).toBe(0)
		expect(typo_distance('tanka', 'tanaka', 2)).toBe(1)
		expect(typo_distance('tanakaa', 'tanaka', 2)).toBe(1)
		expect(typo_distance('tamaka', 'tanaka', 2)).toBe(1)
		expect(typo_distance('tnaaka', 'tanaka', 2)).toBe(1)
	})

	it('stops counting past the limit', () => {
		expect(typo_distance('abcdef', 'uvwxyz', 2)).toBe(3)
		expect(typo_distance('a', 'abcdef', 2)).toBe(3)
	})
})

describe('typo_match', () => {
	it('finds a name or handle despite a typo', () => {
		expect(typo_match('tanka', 'mika_t', 'Mika Tanaka')).toBe(1)
		expect(typo_match('mkia', 'mika_t', 'Mika Tanaka')).toBe(1)
		expect(typo_match('@sorra', 'sora', 'Sora')).toBe(1)
	})

	it('matches the start of a word while it is still being typed', () => {
		expect(typo_match('tanak', 'x', 'Mika Tanakamura')).toBe(0)
		expect(typo_match('tnaak', 'x', 'Mika Tanakamura')).toBe(1)
	})

	it('allows two typos only in longer queries', () => {
		expect(typo_match('tanakmuar', 'x', 'Tanakamura')).toBe(2)
		expect(typo_match('sroa', 'sora', 'Sora')).toBe(1)
		expect(typo_match('sxxa', 'sora', 'Sora')).toBeUndefined()
	})

	it('leaves short queries and unrelated names alone', () => {
		expect(typo_match('mk', 'mika', 'Mika')).toBeUndefined()
		expect(typo_match('hanako', 'sora', 'Sora Aoki')).toBeUndefined()
	})

	it('works for Japanese names', () => {
		expect(typo_match('たなかか', 'x', 'たなか はなこ')).toBe(1)
	})
})
