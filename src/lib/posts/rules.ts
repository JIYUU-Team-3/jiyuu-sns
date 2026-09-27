/** Longest post, in user-perceived characters. */
export const POST_MAX = 280

/** Remaining characters at which the counter shows a number and turns amber. */
export const POST_WARN_AT = 20

const segmenter = new Intl.Segmenter()

/**
 * Length as a reader counts it: one per grapheme, so an emoji or a Khmer cluster is 1.
 * The composer counter and the server check both use this, so they always agree.
 */
export function post_length(body: string): number {
	return [...segmenter.segment(body)].length
}

export type PostProblem = 'empty' | 'too_long'

/** Why a trimmed post body can't be published, or undefined when it can. */
export function post_problem(body: string): PostProblem | undefined {
	if (!body) return 'empty'
	if (post_length(body) > POST_MAX) return 'too_long'
	return undefined
}

/** Counter state: `warn` in the last 20 characters, `over` past the limit. */
export function counter_state(length: number): 'ok' | 'warn' | 'over' {
	if (length > POST_MAX) return 'over'
	if (length > POST_MAX - POST_WARN_AT) return 'warn'
	return 'ok'
}

/**
 * Split a draft at the limit so the part past it can be highlighted, the way X marks overflow.
 * Splits on grapheme boundaries, so a cluster is never cut in half.
 */
export function split_at_limit(body: string): [kept: string, overflow: string] {
	let n = 0
	for (const { index } of segmenter.segment(body)) {
		if (n === POST_MAX) return [body.slice(0, index), body.slice(index)]
		n++
	}
	return [body, '']
}
