/*
 * Typo-tolerant matching for people search, like X's: "tanka" still finds Tanaka. Only used
 * after the plain substring matches, to fill the list with near misses.
 */

const normalize = (text: string) => text.normalize('NFKC').toLowerCase()

/**
 * Edit distance where swapping two neighbouring letters counts as one typo (optimal string
 * alignment). Gives up early once every path is past `max`, returning `max + 1`.
 */
export function typo_distance(a: string, b: string, max: number) {
	if (Math.abs(a.length - b.length) > max) return max + 1
	const x = [...a]
	const y = [...b]
	let before = new Array<number>(y.length + 1).fill(0)
	let previous = Array.from({ length: y.length + 1 }, (_, j) => j)
	for (let i = 1; i <= x.length; i++) {
		const current = [i]
		let row_min = i
		for (let j = 1; j <= y.length; j++) {
			const cost = x[i - 1] === y[j - 1] ? 0 : 1
			let value = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost)
			if (i > 1 && j > 1 && x[i - 1] === y[j - 2] && x[i - 2] === y[j - 1]) {
				value = Math.min(value, before[j - 2] + 1)
			}
			current[j] = value
			row_min = Math.min(row_min, value)
		}
		if (row_min > max) return max + 1
		before = previous
		previous = current
	}
	return previous[y.length]
}

/** How many typos a query of this length may contain: none for very short ones. */
export function typo_budget(length: number) {
	if (length >= 7) return 2
	if (length >= 4) return 1
	return 0
}

/** The pieces someone might start typing: the whole handle or name, and each word in them. */
function words(handle: string, name: string) {
	const h = normalize(handle)
	const n = normalize(name)
	return new Set([h, ...h.split(/[._]/), n, ...n.split(/\s+/)].filter(Boolean))
}

/**
 * The fewest typos between the query and the start of the handle, the name or one of their
 * words, or undefined when it's too far off. The start is compared, not the whole word, because
 * search suggests while the reader is still typing.
 */
export function typo_match(query: string, handle: string, name: string) {
	const q = normalize(query.replace(/^@/, '').trim())
	const max = typo_budget([...q].length)
	if (!max) return undefined
	const length = [...q].length
	let best = max + 1
	for (const word of words(handle, name)) {
		const letters = [...word]
		// The typo may add or drop a letter, so try prefixes a little shorter and longer too.
		for (let cut = length - max; cut <= length + max; cut++) {
			if (cut < 1 || cut > letters.length) continue
			best = Math.min(best, typo_distance(q, letters.slice(0, cut).join(''), max))
			if (best === 0) return 0
		}
	}
	return best <= max ? best : undefined
}
