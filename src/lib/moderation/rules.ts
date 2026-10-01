/**
 * The community rules: what a report names, what a moderator's action cites, and what the
 * guidelines page lists. Shared by server and client, so it holds no text; the wording is in the
 * `rule_*` messages. See docs/MODERATION.md.
 */

/** Removed and the account suspended at once. */
export const NEVER_ALLOWED = [
	'child_safety',
	'threat',
	'terrorism',
	'intimate_media',
	'doxxing',
	'self_harm_encouragement',
] as const

/** Removed; strikes add up to a suspension. */
export const NOT_ALLOWED = [
	'hate',
	'harassment',
	'impersonation',
	'spam',
	'scam',
	'malicious_link',
	'illegal_goods',
	'sexual',
	'gore',
	'copyright',
] as const

export const RULES = [...NEVER_ALLOWED, ...NOT_ALLOWED] as const
export type Rule = (typeof RULES)[number]

export const is_rule = (value: unknown): value is Rule =>
	typeof value === 'string' && (RULES as readonly string[]).includes(value)

export const is_severe = (rule: Rule) => (NEVER_ALLOWED as readonly string[]).includes(rule)

/** Strikes count for this long; older ones no longer lead to a temporary suspension. */
export const STRIKE_WINDOW_DAYS = 90
/** This many strikes inside the window suspend the account for `STRIKE_SUSPENSION_DAYS`. */
export const STRIKES_TO_SUSPEND = 3
export const STRIKE_SUSPENSION_DAYS = 7
/** This many strikes in all suspend the account for good. */
export const STRIKES_TO_BAN = 5

export type StrikeOutcome =
	{ kind: 'warning' } | { kind: 'suspend'; days: number } | { kind: 'ban' }

/**
 * What a new strike leads to, counting it: `recent` strikes inside the window and `total` ever,
 * both including the new one. A strike under a never-allowed rule bans at once.
 */
export function strike_outcome(rule: Rule, recent: number, total: number): StrikeOutcome {
	if (is_severe(rule) || total >= STRIKES_TO_BAN) return { kind: 'ban' }
	if (recent >= STRIKES_TO_SUSPEND) return { kind: 'suspend', days: STRIKE_SUSPENSION_DAYS }
	return { kind: 'warning' }
}

/** Suspension lengths a moderator can pick by hand; `null` is permanent. */
export const SUSPENSION_DAYS = [1, 7, 30, null] as const

/** A suspended account can ask for review once per suspension, in at most this many characters. */
export const REVIEW_REQUEST_MAX = 1000

/** Where a suspended person can write when the review form isn't enough. */
export const MODERATION_EMAIL = 'jiyuu.org@gmail.com'
