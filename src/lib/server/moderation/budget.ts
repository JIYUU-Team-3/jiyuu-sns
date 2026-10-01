import { eq, sql } from 'drizzle-orm'
import type { getDb } from '../db'
import { aiUsage } from '../db/schema'

type Db = ReturnType<typeof getDb>

/**
 * Neurons a day for each kind of check. Workers AI's free allocation is 10,000 a day on the Free
 * plan, after which calls fail until 00:00 UTC; 1,000 are left for `pnpm ai:measure` and for
 * development. Set from Phase 0's measurements; see docs/MODERATION.md.
 */
export const DAILY_NEURONS = { text: 5500, image: 2500, report: 1000 } as const
export type BudgetKind = keyof typeof DAILY_NEURONS

/**
 * What one call is reserved at before it runs, so concurrent checks can't overshoot; the real cost
 * replaces it afterwards. Llama Guard on a full post is about 25; an image about 10.
 */
export const ESTIMATE = { text: 30, image: 15, report: 30 } as const

/** The UTC day, which is how Workers AI counts. */
export const today = (now = Date.now()) => new Date(now).toISOString().slice(0, 10)

/**
 * Set aside `amount` neurons of `kind` for today, or refuse when that would pass the cap. New and
 * restricted accounts may only use the first half of each budget, so a crowd of fresh accounts
 * can't spend it all and leave everyone's posts unchecked.
 */
export async function reserve(
	db: Db,
	kind: BudgetKind,
	amount: number,
	limited = false,
	now = Date.now(),
) {
	const cap = limited ? DAILY_NEURONS[kind] / 2 : DAILY_NEURONS[kind]
	if (amount > cap) return false
	const column = aiUsage[kind]
	// One statement: the row is created or added to only while the total stays under the cap.
	const rows = await db
		.insert(aiUsage)
		.values({ day: today(now), [kind]: amount })
		.onConflictDoUpdate({
			target: aiUsage.day,
			set: { [kind]: sql`${column} + ${amount}` },
			setWhere: sql`${column} + ${amount} <= ${cap}`,
		})
		.returning({ day: aiUsage.day })
	return rows.length > 0
}

/** Replace a reservation with what the call really cost. */
export async function settle(
	db: Db,
	kind: BudgetKind,
	reserved: number,
	spent: number,
	now = Date.now(),
) {
	if (spent === reserved) return
	const column = aiUsage[kind]
	await db
		.update(aiUsage)
		.set({ [kind]: sql`max(0, ${column} + ${spent - reserved})` })
		.where(eq(aiUsage.day, today(now)))
}

/** Workers AI said the day's allocation is used up: stop asking until tomorrow. */
export async function exhaust(db: Db, now = Date.now()) {
	await db
		.insert(aiUsage)
		.values({ day: today(now), ...DAILY_NEURONS })
		.onConflictDoUpdate({ target: aiUsage.day, set: { ...DAILY_NEURONS } })
}
