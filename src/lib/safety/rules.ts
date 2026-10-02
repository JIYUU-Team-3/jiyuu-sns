export const REPLY_AUDIENCES = ['everyone', 'following', 'mentioned'] as const
export type ReplyAudience = (typeof REPLY_AUDIENCES)[number]

export const REPORT_REASONS = [
	'spam',
	'harassment',
	'hate',
	'violence',
	'sexual',
	'self_harm',
	'other',
] as const
export type ReportReason = (typeof REPORT_REASONS)[number]

export const REPORT_NOTE_MAX = 500
export const MUTED_TERMS_MAX = 100
export const TERM_MIN = 2
export const TERM_MAX = 50

export function may_reply(
	audience: ReplyAudience,
	who: { mine: boolean; followed_by_author: boolean; mentioned: boolean },
) {
	if (audience === 'everyone' || who.mine) return true
	return audience === 'following' ? who.followed_by_author : who.mentioned
}

const segmenter = new Intl.Segmenter()

export function normalize_term(raw: string) {
	const term = raw.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()
	const word = term.startsWith('#') ? term.slice(1).trim() : term
	if (term.startsWith('#') && /\s/.test(word)) return undefined
	const length = [...segmenter.segment(word)].length
	if (length < TERM_MIN || length > TERM_MAX) return undefined
	return term.startsWith('#') ? `#${word}` : word
}
