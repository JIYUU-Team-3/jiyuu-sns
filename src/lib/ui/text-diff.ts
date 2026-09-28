const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

/** Khmer's subscript sign: the consonant after it renders below the one before, so they stay one unit. */
const COENG = '្'

/** Split text into the units a morph moves: grapheme clusters, with Khmer subscripts kept whole. */
export function split_graphemes(text: string): string[] {
	const out: string[] = []
	for (const { segment } of graphemes.segment(text)) {
		const last = out.length - 1
		if (last >= 0 && out[last].endsWith(COENG)) out[last] += segment
		else out.push(segment)
	}
	return out
}

/** Pairs of indexes, old to new, of a longest common subsequence under `same`. */
function common_pairs(a: string[], b: string[], same: (x: string, y: string) => boolean) {
	const table = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
	for (let i = a.length - 1; i >= 0; i--) {
		for (let j = b.length - 1; j >= 0; j--) {
			table[i][j] = same(a[i], b[j])
				? table[i + 1][j + 1] + 1
				: Math.max(table[i + 1][j], table[i][j + 1])
		}
	}
	const pairs: [number, number][] = []
	let i = 0
	let j = 0
	while (i < a.length && j < b.length) {
		if (same(a[i], b[j])) pairs.push([i++, j++])
		else if (table[i + 1][j] >= table[i][j + 1]) i++
		else j++
	}
	return pairs
}

/**
 * How each unit of the new text relates to the old: `from` is the index of the old unit it moves
 * from, or null when it is new. Units that differ only in case ("F" and "f") are matched too, and
 * cross-fade in place. `removed` lists the old units with no counterpart.
 */
export type TextDiff = {
	units: { text: string; from: number | null }[]
	removed: number[]
}

export function diff_text(before: string[], after: string[]): TextDiff {
	const pairs = common_pairs(before, after, (x, y) => x.toLowerCase() === y.toLowerCase())
	const from = new Map(pairs.map(([i, j]) => [j, i]))
	const kept = new Set(pairs.map(([i]) => i))
	return {
		units: after.map((text, j) => ({ text, from: from.get(j) ?? null })),
		removed: before.flatMap((_, i) => (kept.has(i) ? [] : [i])),
	}
}

/**
 * Like `diff_text`, for numbers: units line up from the right, as digits do, and a unit is kept
 * only where the same text sits in the same place. So 19 to 20 changes both digits, and 9 to 10
 * keeps nothing, where a sequence match would slide a shared digit sideways.
 */
export function diff_places(before: string[], after: string[]): TextDiff {
	const shift = before.length - after.length
	const same = (j: number) => j + shift >= 0 && before[j + shift] === after[j]
	const kept = new Set(after.flatMap((_, j) => (same(j) ? [j + shift] : [])))
	return {
		units: after.map((text, j) => ({ text, from: same(j) ? j + shift : null })),
		removed: before.flatMap((_, i) => (kept.has(i) ? [] : [i])),
	}
}
