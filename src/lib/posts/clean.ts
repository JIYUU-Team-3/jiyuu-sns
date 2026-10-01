/**
 * Bidi overrides and isolates reorder the text around them, so a post could show its words in a
 * different order from the one it was written in. Control characters other than line breaks and
 * tabs draw nothing. Zero-width joiners stay: emoji and Khmer are written with them.
 */
const INVISIBLE = /(?![\n\t])\p{Cc}|[\u202a-\u202e\u2066-\u2069]/gu

/**
 * Most combining marks one character keeps. Real writing stacks two or three (Vietnamese, Khmer,
 * Thai); "Zalgo" text stacks dozens, so one character can overflow its row and cover others.
 */
export const MARKS_MAX = 4

const segmenter = new Intl.Segmenter()

/** Post or message text as it's stored: without those characters, and marks capped per character. */
export function clean_text(text: string) {
	const visible = text.replace(INVISIBLE, '')
	if (!/\p{M}{5}/u.test(visible)) return visible
	let out = ''
	for (const { segment } of segmenter.segment(visible)) {
		let marks = 0
		for (const char of segment) {
			if (/\p{M}/u.test(char) && ++marks > MARKS_MAX) continue
			out += char
		}
	}
	return out
}
