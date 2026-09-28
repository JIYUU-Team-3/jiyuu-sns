import { describe, expect, it } from 'vitest'
import en from '../../../messages/en.json'
import ja from '../../../messages/ja.json'
import km from '../../../messages/km.json'
import { diff_places, diff_text, split_graphemes } from './text-diff'

/** The kept, case-swapped, added and removed text of a morph, each run joined up. */
function summary(before: string, after: string) {
	const old = split_graphemes(before)
	const { units, removed } = diff_text(old, split_graphemes(after))
	const pick = (keep: (u: (typeof units)[number]) => boolean) =>
		units
			.filter(keep)
			.map((u) => u.text)
			.join('')
	return {
		kept: pick((u) => u.from !== null && old[u.from] === u.text),
		swapped: pick((u) => u.from !== null && old[u.from] !== u.text),
		added: pick((u) => u.from === null),
		removed: removed.map((i) => old[i]).join(''),
	}
}

describe('split_graphemes', () => {
	it('keeps Khmer vowel signs on their consonant', () => {
		expect(split_graphemes('កំពុង')).toEqual(['កំ', 'ពុ', 'ង'])
	})

	it('keeps a Khmer subscript consonant with the one above it', () => {
		expect(split_graphemes('ស្រី')).toEqual(['ស្រី'])
	})
})

describe('diff_text', () => {
	it('adds only the ending when Follow becomes Following', () => {
		expect(summary('Follow', 'Following')).toEqual({
			kept: 'Follow',
			swapped: '',
			added: 'ing',
			removed: '',
		})
	})

	it('swaps F for f when Following becomes Unfollow', () => {
		expect(summary('Following', 'Unfollow')).toEqual({
			kept: 'ollow',
			swapped: 'f',
			added: 'Un',
			removed: 'ing',
		})
	})

	it('swaps f for F when Unfollow becomes Follow back', () => {
		expect(summary('Unfollow', 'Follow back')).toEqual({
			kept: 'ollow',
			swapped: 'F',
			added: ' back',
			removed: 'Un',
		})
	})

	it('shares フォロー across the Japanese labels', () => {
		expect(summary(ja.follow_following, ja.follow_unfollow)).toMatchObject({
			kept: 'フォロー',
			added: '解除',
			removed: '中',
		})
	})

	it('shares តាមដាន across the Khmer labels', () => {
		expect(summary(km.follow_following, km.follow_unfollow)).toMatchObject({
			kept: 'តាមដាន',
			added: 'ឈប់',
			removed: 'កំពុង',
		})
	})

	it('rebuilds every label from every other one', () => {
		for (const messages of [en, ja, km]) {
			const labels = [
				messages.follow_follow,
				messages.follow_follow_back,
				messages.follow_following,
				messages.follow_unfollow,
			]
			for (const before of labels) {
				for (const after of labels) {
					const old = split_graphemes(before)
					const { units, removed } = diff_text(old, split_graphemes(after))
					expect(units.map((u) => u.text).join('')).toBe(after)
					expect(units.filter((u) => u.from !== null).length + removed.length).toBe(old.length)
				}
			}
		}
	})
})

describe('diff_places', () => {
	const diff = (before: string, after: string) =>
		diff_places(split_graphemes(before), split_graphemes(after))

	it('keeps digits that stay in place', () => {
		expect(diff('12', '13')).toEqual({
			units: [
				{ text: '1', from: 0 },
				{ text: '3', from: null },
			],
			removed: [1],
		})
	})

	it('lines digits up from the right when the length grows', () => {
		expect(diff('9', '10').units.map((u) => u.from)).toEqual([null, null])
		expect(diff('19', '109').units.map((u) => u.from)).toEqual([null, null, 1])
	})

	it('drops the leading digits when the length shrinks', () => {
		expect(diff('109', '99')).toEqual({
			units: [
				{ text: '9', from: null },
				{ text: '9', from: 2 },
			],
			removed: [0, 1],
		})
	})

	it('never slides a shared digit sideways', () => {
		expect(diff('12', '21').units.map((u) => u.from)).toEqual([null, null])
	})

	it('keeps a compact suffix', () => {
		expect(diff('1.2K', '1.3K').units.map((u) => u.from)).toEqual([0, 1, null, 3])
	})
})
