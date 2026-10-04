/**
 * How "For you" is ordered: three lists over the same candidates, dealt into fixed slots so the top
 * always holds new, popular and rising posts together. No model; every number here is a rule.
 */

const HOUR = 60 * 60 * 1000

/** The newest top-level posts that are ranked at all, which bounds what one page costs. */
export const CANDIDATES_MAX = 500

/** One point of score is this many hours of freshness; so is each doubling of engagement. */
export const POINT_HOURS = 6
/** A post by someone the viewer follows starts this many points up. */
export const FOLLOW_POINTS = 2

/**
 * Each top-level post by the same author in this long after a post costs it a point, so a burst
 * shows its newest post and sinks the older ones.
 */
export const FLOOD_WINDOW = 6 * HOUR
export const FLOOD_POINTS_MAX = 6
/** This much of the author's behaviour score (0 to 100) costs a point. */
export const BEHAVIOUR_PER_POINT = 20
/** Each report on a post's open case costs a point, capped so a few people can't bury a post. */
export const REPORT_POINTS_MAX = 4

/**
 * Rising posts are this young, liked, reposted or answered by someone else, and not from a followed
 * account.
 */
export const RISING_WINDOW = 3 * HOUR

/**
 * An author shows up at most once in this many positions in a row, so one busy account can't fill
 * the top. Their next post waits for a later position, or goes in anyway once nobody else is left.
 */
export const AUTHOR_GAP = 5

/** Which list fills each position, repeated down the page. */
export const SLOTS = ['new', 'hot', 'new', 'hot', 'rising'] as const
type Slot = (typeof SLOTS)[number]

/** What the ranking reads about one post. */
export type Signals = {
	id: string
	author: string
	created_at: number
	/** Likes from accounts past their first days and not restricted, the author's own left out. */
	likes: number
	/** Visible replies from anyone but the author. */
	replies: number
	/** Reposts counted the same way as likes. */
	reposts: number
	followed: boolean
	mine: boolean
	/** The author's top-level posts in `FLOOD_WINDOW` after this one. */
	later: number
	/** The author's behaviour score, 0 to 100. */
	behaviour: number
	/** Reports on the post's open case. */
	reports: number
}

const engagement = (s: Signals) => s.likes + 2 * s.replies + 2 * s.reposts

/** Points a post loses to spam signals, whichever list it's in. */
export const penalty = (s: Signals) =>
	Math.min(FLOOD_POINTS_MAX, s.later) +
	s.behaviour / BEHAVIOUR_PER_POINT +
	Math.min(REPORT_POINTS_MAX, s.reports)

/** Age in points: zero now, one lower every `POINT_HOURS`. */
const freshness = (s: Signals, as_of: number) => (s.created_at - as_of) / (POINT_HOURS * HOUR)

export const new_score = (s: Signals, as_of: number) => freshness(s, as_of) - penalty(s)

export const hot_score = (s: Signals, as_of: number) =>
	Math.log2(1 + engagement(s)) + (s.followed ? FOLLOW_POINTS : 0) + new_score(s, as_of)

/** Undefined when the post isn't rising. */
export function rising_score(s: Signals, as_of: number) {
	const young = s.created_at > as_of - RISING_WINDOW
	if (!young || s.followed || s.mine || engagement(s) < 1) return undefined
	return engagement(s) - penalty(s)
}

/**
 * Every candidate's id in the order the feed shows them: each position takes the best post its
 * slot's list hasn't given yet, and a post already placed is skipped, as is one whose author is
 * within `AUTHOR_GAP`. A list that has run out hands its slots to the hot one, so the feed ends
 * only when every candidate is placed.
 */
export function slotted(candidates: Signals[], as_of: number): string[] {
	const ordered = (score: (s: Signals) => number | undefined) =>
		candidates
			.map((s) => ({ s, score: score(s) }))
			.filter((row): row is { s: Signals; score: number } => row.score !== undefined)
			.sort(
				(a, b) =>
					b.score - a.score || b.s.created_at - a.s.created_at || (a.s.id < b.s.id ? 1 : -1),
			)
			.map((row) => row.s)
	const lists: Record<Slot, Signals[]> = {
		new: ordered((s) => new_score(s, as_of)),
		hot: ordered((s) => hot_score(s, as_of)),
		rising: ordered((s) => rising_score(s, as_of)),
	}
	const at: Record<Slot, number> = { new: 0, hot: 0, rising: 0 }
	const placed = new Set<string>()
	const next = (slot: Slot, recent: Set<string>) => {
		const list = lists[slot]
		while (at[slot] < list.length && placed.has(list[at[slot]].id)) at[slot] += 1
		return list.slice(at[slot]).find((s) => !placed.has(s.id) && !recent.has(s.author))
	}
	const order: Signals[] = []
	while (order.length < candidates.length) {
		const slot = SLOTS[order.length % SLOTS.length]
		const recent = new Set(order.slice(1 - AUTHOR_GAP).map((s) => s.author))
		const s = next(slot, recent) ?? next('hot', recent) ?? next('hot', new Set())
		if (s === undefined) break
		placed.add(s.id)
		order.push(s)
	}
	return order.map((s) => s.id)
}
