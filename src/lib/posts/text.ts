/** A run of post text: plain, a link (`href`), or a hashtag (`tag`, without the `#`). */
export type TextSegment = { text: string; href?: string; tag?: string }

/** http(s) links, without the punctuation that usually ends the sentence around them. */
const URL_SOURCE = String.raw`https?:\/\/[^\s<>"]*[^\s<>".,:;!?)\]'’”]`

/**
 * `#tag` in any script: letters, digits, combining marks (Khmer, Devanagari) and `_`, with at
 * least one non-digit so `#1` stays plain. A `#` glued to a word or another `#` isn't a tag.
 */
const TAG_SOURCE = String.raw`(?<![\p{L}\p{N}\p{M}_&#/])[#＃]([\p{L}\p{N}\p{M}_]*[\p{L}\p{M}_][\p{L}\p{N}\p{M}_]*)`

// URLs come first in the alternation, so a `#fragment` inside a link stays part of the link.
const TOKEN_PATTERN = new RegExp(`(${URL_SOURCE})|${TAG_SOURCE}`, 'gu')

function token(match: RegExpMatchArray): TextSegment {
	const [whole, url, tag] = match
	if (url) return { text: url.replace(/^https?:\/\//, ''), href: url }
	return { text: whole, tag }
}

/**
 * Split post text into plain runs, links and hashtags. Links show without their scheme, like X.
 * @mentions stay plain for now.
 */
export function text_segments(body: string): TextSegment[] {
	const segments: TextSegment[] = []
	let last = 0
	for (const match of body.matchAll(TOKEN_PATTERN)) {
		if (match.index > last) segments.push({ text: body.slice(last, match.index) })
		segments.push(token(match))
		last = match.index + match[0].length
	}
	if (last < body.length) segments.push({ text: body.slice(last) })
	return segments
}
