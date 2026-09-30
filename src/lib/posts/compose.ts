/*
 * Composer helpers: which @mention or #tag is being typed at the caret, filling it in from a
 * suggestion, and colouring links, tags and mentions in the draft, like X.
 */

export type Typing = {
	kind: '@' | '#'
	/** What follows the `@` or `#` so far. */
	query: string
	/** Where the `@` or `#` is, and where the word ends (it may continue past the caret). */
	start: number
	end: number
}

// Same boundaries as the post parser in ./text, so a suggestion is offered exactly where the
// finished word will become a link.
const MENTION_BEFORE_CARET = /(?:^|[^\p{L}\p{M}\p{N}_.@])@([A-Za-z0-9_.]{1,20})$/u
const TAG_BEFORE_CARET = /(?:^|[^\p{L}\p{M}\p{N}_&/#@])#([\p{L}\p{M}\p{N}_]{1,50})$/u

/** The mention or hashtag the caret is in, if any. */
export function typing_at(text: string, caret: number): Typing | undefined {
	const before = text.slice(0, caret)
	const mention = before.match(MENTION_BEFORE_CARET)
	if (mention) {
		const rest = text.slice(caret).match(/^[A-Za-z0-9_.]*/)![0]
		return {
			kind: '@',
			query: mention[1],
			start: caret - mention[1].length - 1,
			end: caret + rest.length,
		}
	}
	const tag = before.match(TAG_BEFORE_CARET)
	if (tag) {
		const rest = text.slice(caret).match(/^[\p{L}\p{M}\p{N}_]*/u)![0]
		return { kind: '#', query: tag[1], start: caret - tag[1].length - 1, end: caret + rest.length }
	}
	return undefined
}

/**
 * Put the picked handle or tag in place of the word being typed, followed by a space unless
 * one is already there, and say where the caret goes.
 */
export function complete(text: string, typing: Typing, value: string) {
	const after = text.slice(typing.end)
	const insert = `${typing.kind}${value}${after.startsWith(' ') ? '' : ' '}`
	const caret = typing.start + insert.length + (after.startsWith(' ') ? 1 : 0)
	return { text: text.slice(0, typing.start) + insert + after, caret }
}

export type Run = {
	text: string
	/** Where it starts in the draft. */
	start: number
	/** Part of a link, hashtag or mention. */
	accent: boolean
	/** Past the length limit. */
	over: boolean
}

/**
 * The draft cut into runs wherever colouring changes: link/tag/mention edges, the length limit,
 * and any extra `cuts` (the caret, so the composer can find its position on screen).
 */
export function highlight_runs(
	text: string,
	limit: number,
	accents: [number, number][],
	cuts: number[] = [],
): Run[] {
	const edges = new Set([0, text.length, Math.min(limit, text.length), ...accents.flat(), ...cuts])
	const points = [...edges].filter((at) => at >= 0 && at <= text.length).sort((a, b) => a - b)
	const runs: Run[] = []
	for (let i = 0; i < points.length - 1; i++) {
		const [from, to] = [points[i], points[i + 1]]
		runs.push({
			text: text.slice(from, to),
			start: from,
			accent: accents.some(([start, end]) => from >= start && to <= end),
			over: from >= limit,
		})
	}
	return runs
}
