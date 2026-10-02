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

/** Each top-level post by the same author in this long before a post costs it a point. */
export const FLOOD_WINDOW = 6 * HOUR
export const FLOOD_POINTS_MAX = 6
/** This much of the author's behaviour score (0 to 100) costs a point. */
export const BEHAVIOUR_PER_POINT = 20
/** Each report on a post's open case costs a point, capped so a few people can't bury a post. */
export const REPORT_POINTS_MAX = 4

/** Rising posts are this young, liked or answered by someone else, and not from a followed account. */
export const RISING_WINDOW = 3 * HOUR

/** Which list fills each position, repeated down the page. */
export const SLOTS = ['new', 'hot', 'new', 'hot', 'rising'] as const
type Slot = (typeof SLOTS)[number]

/** What the ranking reads about one post. */
export type Signals = {
	id: string
	created_at: number
	/** Likes from accounts past their first days and not restricted, the author's own left out. */
	likes: number
	/** Visible replies from anyone but the author. */
	replies: number
	followed: boolean
	mine: boolean
	/** The author's top-level posts in `FLOOD_WINDOW` before this one. */
	earlier: number
	/** The author's behaviour score, 0 to 100. */
	behaviour: number
	/** Reports on the post's open case. */
	reports: number
}

const engagement = (s: Signals) => s.likes + 2 * s.replies

/** Points a post loses to spam signals, whichever list it's in. */
export const penalty = (s: Signals) =>
	Math.min(FLOOD_POINTS_MAX, s.earlier) +
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
 * slot's list hasn't given yet, and a post already placed is skipped. A list that has run out
 * hands its slots to the hot one, so the feed ends only when every candidate is placed.
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
			.map((row) => row.s.id)
	const lists: Record<Slot, string[]> = {
		new: ordered((s) => new_score(s, as_of)),
		hot: ordered((s) => hot_score(s, as_of)),
		rising: ordered((s) => rising_score(s, as_of)),
	}
	const at: Record<Slot, number> = { new: 0, hot: 0, rising: 0 }
	const placed = new Set<string>()
	const next = (slot: Slot) => {
		const list = lists[slot]
		while (at[slot] < list.length && placed.has(list[at[slot]])) at[slot] += 1
		return list[at[slot]]
	}
	const order: string[] = []
	while (order.length < candidates.length) {
		const id = next(SLOTS[order.length % SLOTS.length]) ?? next('hot')
		if (id === undefined) break
		placed.add(id)
		order.push(id)
	}
	return order
}
