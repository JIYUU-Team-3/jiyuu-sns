/**
 * A run of post text: plain, an external link (`href`), a hashtag (`tag`, normalised) or an
 * @mention (`handle`, lowercase). `text` is always what the reader sees.
 */
export type TextSegment = { text: string; href?: string; tag?: string; handle?: string }

/** http(s) links, without the punctuation that usually ends the sentence around them. */
const URL_PATTERN = /https?:\/\/[^\s<>"]*[^\s<>".,:;!?)\]'’”]/g

/**
 * `#` (or the full-width `＃` Japanese keyboards type) then letters, marks (so Khmer and
 * Japanese tags work) and digits. A `#` glued to a word, a URL fragment or an `&#` entity isn't
 * a tag.
 */
const TAG_PATTERN =
	/(?<![\p{L}\p{M}\p{N}_&/#＃@])[#＃]([\p{L}\p{M}\p{N}_]{1,50})(?![\p{L}\p{M}\p{N}_])/gu

/** `@` then handle characters; an `@` inside a word, like an email address, isn't a mention. */
const MENTION_PATTERN = /(?<![\p{L}\p{M}\p{N}_.@])@([A-Za-z0-9_.]+)/gu

/** Handles as onboarding allows them. */
const HANDLE_PATTERN = /^[a-z0-9_.]{3,20}$/

/** How a tag is stored and compared: `#Svelte` and `#ｓｖｅｌｔｅ` are the same tag. */
export const normalize_tag = (tag: string) => tag.normalize('NFKC').toLowerCase()

type Token = { start: number; end: number; segment: TextSegment }

function tags_in(text: string, offset: number): Token[] {
	const tokens: Token[] = []
	for (const match of text.matchAll(TAG_PATTERN)) {
		// `#1` is a number, not a topic.
		if (/^\p{N}+$/u.test(match[1])) continue
		tokens.push({
			start: offset + match.index,
			end: offset + match.index + match[0].length,
			segment: { text: match[0], tag: normalize_tag(match[1]) },
		})
	}
	return tokens
}

function mentions_in(text: string, offset: number): Token[] {
	const tokens: Token[] = []
	for (const match of text.matchAll(MENTION_PATTERN)) {
		// A dot that ends the sentence isn't part of the handle.
		let length = match[1].length
		while (match[1][length - 1] === '.') length--
		const name = match[1].slice(0, length)
		const handle = name.toLowerCase()
		if (!HANDLE_PATTERN.test(handle)) continue
		tokens.push({
			start: offset + match.index,
			end: offset + match.index + 1 + name.length,
			segment: { text: `@${name}`, handle },
		})
	}
	return tokens
}

/** Every link, hashtag and mention in order, with where it sits in the text. */
function tokens_in(body: string): Token[] {
	const tokens: Token[] = []
	let last = 0
	const between = (start: number, end: number) => {
		const text = body.slice(start, end)
		tokens.push(...tags_in(text, start), ...mentions_in(text, start))
	}
	for (const match of body.matchAll(URL_PATTERN)) {
		between(last, match.index)
		const end = match.index + match[0].length
		tokens.push({
			start: match.index,
			end,
			segment: { text: match[0].replace(/^https?:\/\//, ''), href: match[0] },
		})
		last = end
	}
	between(last, body.length)
	return tokens.sort((a, b) => a.start - b.start)
}

/**
 * Split post text into plain runs, links, hashtags and mentions. Links show without their
 * scheme, like X. A `#` or `@` inside a link stays part of the link.
 */
export function text_segments(body: string): TextSegment[] {
	const segments: TextSegment[] = []
	let at = 0
	for (const token of tokens_in(body)) {
		if (token.start < at) continue
		if (token.start > at) segments.push({ text: body.slice(at, token.start) })
		segments.push(token.segment)
		at = token.end
	}
	if (at < body.length) segments.push({ text: body.slice(at) })
	return segments
}

/** Where the links, hashtags and mentions are, as `[start, end)` offsets, for highlighting. */
export function accent_ranges(body: string): [number, number][] {
	return tokens_in(body).map((token) => [token.start, token.end])
}

/** The distinct normalised hashtags in a post, in order of first use. */
export function extract_tags(body: string) {
	return [...new Set(text_segments(body).flatMap((s) => (s.tag ? [s.tag] : [])))]
}

/** The distinct lowercase handles a post mentions, in order of first use. */
export function extract_mentions(body: string) {
	return [...new Set(text_segments(body).flatMap((s) => (s.handle ? [s.handle] : [])))]
}
