export type TextSegment = { text: string; href?: string }

/** http(s) links, without the punctuation that usually ends the sentence around them. */
const URL_PATTERN = /https?:\/\/[^\s<>"]*[^\s<>".,:;!?)\]'’”]/g

/**
 * Split post text into plain runs and links. Links show without their scheme, like X.
 * Hashtags and @mentions stay plain until search and profiles exist to link them to.
 */
export function text_segments(body: string): TextSegment[] {
	const segments: TextSegment[] = []
	let last = 0
	for (const match of body.matchAll(URL_PATTERN)) {
		if (match.index > last) segments.push({ text: body.slice(last, match.index) })
		segments.push({ text: match[0].replace(/^https?:\/\//, ''), href: match[0] })
		last = match.index + match[0].length
	}
	if (last < body.length) segments.push({ text: body.slice(last) })
	return segments
}
