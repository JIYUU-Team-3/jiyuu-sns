import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { format_count } from '#lib/posts/format'
import RollSlot from './fixtures/RollSlot.svelte'

const frame = () => new Promise((resolve) => requestAnimationFrame(resolve))
const left = (el: Element | null) => el?.getBoundingClientRect().left ?? NaN

/**
 * Roll the slot from one count to another and record, every frame until it settles, where the
 * shown digits start and where the next thing in the row sits.
 */
async function roll(from: number, to: number, locale: 'en' | 'ja' = 'en') {
	const text = (n: number) => (n ? format_count(n, locale) : '')
	const screen = render(RollSlot, { value: from, text: text(from) })
	await frame()
	const slot = document.querySelector('.cnt')!
	const units = () => [...slot.querySelectorAll('.letters .unit')]
	const before = units().map(left)
	const after_box = left(document.querySelector('.after'))
	const start = left(slot)

	await screen.rerender({ value: to, text: text(to) })
	const frames: { digits: number; after: number; ghosts: number[] }[] = []
	for (let i = 0; i < 30; i++) {
		frames.push({
			digits: left(units()[0] ?? null),
			after: left(document.querySelector('.after')),
			ghosts: [...slot.querySelectorAll('.ghost')].map(left),
		})
		await frame()
	}
	screen.unmount()
	return { start, before, after_box, frames, shown: text(to) }
}

const CASES: [number, number, ('en' | 'ja')?][] = [
	[0, 1],
	[1, 0],
	[9, 10],
	[10, 9],
	[99, 100],
	[100, 99],
	[999, 1000],
	[1000, 999],
	[1200, 1300],
	[9999, 10_000],
	[99_999, 100_000],
	[123_000, 124_000],
	[999_999, 1_000_000],
	[1_000_000, 999_999],
	[1_200_000, 1_300_000],
	[999, 1000, 'ja'],
	[9999, 10_000, 'ja'],
	[10_000, 9999, 'ja'],
	[99_999, 100_000, 'ja'],
	[999_000, 999_999, 'ja'],
]

describe('NumberRoll anchored at the start', () => {
	it.each(CASES.map(([from, to, locale = 'en']) => [from, to, locale] as const))(
		'rolls %i → %i (%s) without sliding sideways',
		async (from, to, locale) => {
			const { start, before, after_box, frames, shown } = await roll(from, to, locale)
			for (const f of frames) {
				// The row beside the count never moves.
				expect(f.after).toBeCloseTo(after_box, 1)
				// The count's first digit stays at the slot's start the whole way.
				if (shown) expect(f.digits).toBeCloseTo(start, 1)
			}
			// Leaving digits start exactly where they were shown.
			const [first] = frames
			for (const x of first.ghosts) {
				expect(before.some((b) => Math.abs(b - x) < 0.5)).toBe(true)
			}
		},
	)
})
