import type { Locale } from '#lib/paraglide/runtime'
import { text_segments } from './text'

/** Fewest letters worth translating; a lone "lol" or emoji isn't. */
const MIN_LETTERS = 3

const count = (text: string, pattern: RegExp) => text.match(pattern)?.length ?? 0

/**
 * The language a post is written in, guessed from its script: Khmer letters, kana or kanji, or
 * Latin letters, whichever there are most of. Only the three the app speaks; undefined when the
 * text is too short or none of them. Links, tags and mentions don't count.
 */
export function guess_language(body: string): Locale | undefined {
	const words = text_segments(body)
		.filter((segment) => !segment.href && !segment.tag && !segment.handle)
		.map((segment) => segment.text)
		.join(' ')
	const khmer = count(words, /\p{Script=Khmer}/gu)
	const japanese = count(words, /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/gu)
	const latin = count(words, /\p{Script=Latin}/gu)
	// A kanji or kana is a word's worth of Latin letters, roughly.
	const scores: [Locale, number][] = [
		['km', khmer],
		['ja', japanese * 3],
		['en', latin],
	]
	const [best, score] = scores.reduce((a, b) => (b[1] > a[1] ? b : a))
	const letters = khmer + japanese + latin
	return letters >= MIN_LETTERS && score > 0 ? best : undefined
}

/** Whether to offer "Translate post": the post is in a language other than the reader's. */
export function translatable(body: string, reader: Locale) {
	const language = guess_language(body)
	return language !== undefined && language !== reader
}
