/** Longest post, in user-perceived characters. */
export const POST_MAX = 280

/** Remaining characters at which the counter shows a number and turns amber. */
export const POST_WARN_AT = 20

/** Photos, GIFs and videos on one post. */
export const MEDIA_MAX = 6

/** Longest video, in seconds. */
export const VIDEO_MAX_SECONDS = 900

/** Longest description (alt text) on one photo or GIF. */
export const ALT_MAX = 1000

export const POLL_MIN_OPTIONS = 2
export const POLL_MAX_OPTIONS = 4
export const POLL_OPTION_MAX = 25
export const POLL_DAYS = [1, 3, 7] as const
export type PollDays = (typeof POLL_DAYS)[number]

export const LOCATION_MAX = 120

export const THREAD_MAX = 10

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
export function post_problem(body: string, has_attachments = false): PostProblem | undefined {
	if (!body && !has_attachments) return 'empty'
	if (post_length(body) > POST_MAX) return 'too_long'
	return undefined
}

/** What a post carries besides its text, as the composer sends it. */
export type DraftShape = {
	body: string
	/** `url` is missing while an upload is in flight. */
	media: { url?: string }[]
	poll?: { options: string[] }
}

export type DraftProblem =
	| PostProblem
	| 'too_much_media'
	| 'duplicate_media'
	| 'poll_media'
	| 'poll_question'
	| 'poll_options'

/** Whether two items share a URL: a post's media are told apart by URL when it's edited. */
export function has_duplicates(media: { url?: string }[]) {
	const urls = media.flatMap((item) => (item.url ? [item.url] : []))
	return new Set(urls).size !== urls.length
}

/** Filled-in poll choices, trimmed; blank optional ones are dropped. */
export const poll_options = (options: string[]) => options.map((o) => o.trim()).filter(Boolean)

/**
 * Why a post can't be published. Text is optional next to photos, but a poll is
 * a question, so it needs text, at least two choices, and no photos beside it.
 */
export function draft_problem(draft: DraftShape): DraftProblem | undefined {
	if (draft.media.length > MEDIA_MAX) return 'too_much_media'
	if (has_duplicates(draft.media)) return 'duplicate_media'
	if (draft.poll) {
		if (draft.media.length) return 'poll_media'
		if (!draft.body) return 'poll_question'
		const options = poll_options(draft.poll.options)
		if (options.length < POLL_MIN_OPTIONS || options.length > POLL_MAX_OPTIONS)
			return 'poll_options'
		if (options.some((o) => post_length(o) > POLL_OPTION_MAX)) return 'poll_options'
	}
	return post_problem(draft.body, draft.media.length > 0)
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
