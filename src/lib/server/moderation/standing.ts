import { and, count, desc, eq, gte, isNull, sql } from 'drizzle-orm'
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core'
import { STRIKE_WINDOW_DAYS, type Rule } from '#lib/moderation/rules'
import type { getDb } from '../db'
import { accountStanding, appeal, moderationAction } from '../db/schema'

type Db = ReturnType<typeof getDb>

export type Suspension = {
	/** Null for a permanent suspension. */
	until: number | null
	reason: string | null
	action_id: string | null
}

export type Standing = { role: 'member' | 'moderator'; suspension?: Suspension }

const DAY = 24 * 60 * 60 * 1000

/** Whether the account in `user_id` moderates, for queries that list people beside their names. */
export const is_moderator = (user_id: AnySQLiteColumn) =>
	sql<number>`exists(select 1 from account_standing s where s.user_id = ${user_id} and s.role = 'moderator')`

/** A row's suspension, if it is in force at `now`. An ended one needs no job to lift it. */
export function active_suspension(
	row: Pick<
		typeof accountStanding.$inferSelect,
		'suspendedAt' | 'suspendedUntil' | 'suspendReason' | 'suspendActionId'
	>,
	now = Date.now(),
): Suspension | undefined {
	if (!row.suspendedAt) return undefined
	const until = row.suspendedUntil?.getTime() ?? null
	if (until !== null && until <= now) return undefined
	return { until, reason: row.suspendReason, action_id: row.suspendActionId }
}

/** One primary-key read per request, from `hooks.server.ts`. No row is a member in good standing. */
export async function find_standing(db: Db, user_id: string): Promise<Standing> {
	const [row] = await db
		.select()
		.from(accountStanding)
		.where(eq(accountStanding.userId, user_id))
		.limit(1)
	if (!row) return { role: 'member' }
	return { role: row.role, suspension: active_suspension(row) }
}

/**
 * Suspend an account for `days` (null for good), recording the action it can ask to have
 * reviewed. Moderators can't be suspended this way, so one can't lock the others out.
 */
export async function suspend(
	db: Db,
	input: {
		moderator_id: string | null
		user_id: string
		reason: Rule
		days: number | null
		note?: string
		case_id?: string
		strike?: boolean
	},
) {
	const now = new Date()
	const until = input.days === null ? null : new Date(now.getTime() + input.days * DAY)
	const action_id = crypto.randomUUID()
	const [, standing] = await db.batch([
		db.insert(moderationAction).values({
			id: action_id,
			caseId: input.case_id,
			moderatorId: input.moderator_id,
			action: 'suspend',
			reason: input.reason,
			strike: input.strike ?? false,
			targetKind: 'account',
			targetId: input.user_id,
			targetUserId: input.user_id,
			expiresAt: until,
			note: input.note || null,
		}),
		db
			.insert(accountStanding)
			.values({
				userId: input.user_id,
				suspendedAt: now,
				suspendedUntil: until,
				suspendReason: input.reason,
				suspendActionId: action_id,
				updatedAt: now,
			})
			.onConflictDoUpdate({
				target: accountStanding.userId,
				set: {
					suspendedAt: now,
					suspendedUntil: until,
					suspendReason: input.reason,
					suspendActionId: action_id,
					updatedAt: now,
				},
				setWhere: sql`${accountStanding.role} <> 'moderator'`,
			})
			.returning({ id: accountStanding.userId, role: accountStanding.role }),
	])
	if (!standing.length || standing[0].role === 'moderator') {
		// The row was a moderator's and wasn't changed; take back the action it would have cited.
		await db.delete(moderationAction).where(eq(moderationAction.id, action_id))
		return undefined
	}
	return action_id
}

/** End a suspension early, recording who did it. */
export async function lift_suspension(
	db: Db,
	moderator_id: string,
	user_id: string,
	note?: string,
) {
	const now = new Date()
	await db.batch([
		db
			.update(accountStanding)
			.set({
				suspendedAt: null,
				suspendedUntil: null,
				suspendReason: null,
				suspendActionId: null,
				updatedAt: now,
			})
			.where(eq(accountStanding.userId, user_id)),
		db
			.update(moderationAction)
			.set({ reversedAt: now })
			.where(
				and(
					eq(moderationAction.targetUserId, user_id),
					eq(moderationAction.action, 'suspend'),
					isNull(moderationAction.reversedAt),
				),
			),
		db.insert(moderationAction).values({
			moderatorId: moderator_id,
			action: 'unsuspend',
			targetKind: 'account',
			targetId: user_id,
			targetUserId: user_id,
			note: note || null,
		}),
	])
}

/**
 * Undo one suspension after its review is upheld. Only that action is reversed, and the account is
 * freed only if that is still the suspension in force: a newer one, for something else, stays.
 */
export async function uphold_suspension_review(
	db: Db,
	moderator_id: string,
	user_id: string,
	action_id: string,
) {
	const now = new Date()
	const [freed] = await db.batch([
		db
			.update(accountStanding)
			.set({
				suspendedAt: null,
				suspendedUntil: null,
				suspendReason: null,
				suspendActionId: null,
				updatedAt: now,
			})
			.where(
				and(eq(accountStanding.userId, user_id), eq(accountStanding.suspendActionId, action_id)),
			)
			.returning({ id: accountStanding.userId }),
		db
			.update(moderationAction)
			.set({ reversedAt: now })
			.where(and(eq(moderationAction.id, action_id), isNull(moderationAction.reversedAt))),
	])
	// The history says "unsuspended" only when the account was; a newer suspension stays in force.
	if (!freed.length) return
	await db.insert(moderationAction).values({
		moderatorId: moderator_id,
		action: 'unsuspend',
		targetKind: 'account',
		targetId: user_id,
		targetUserId: user_id,
		note: 'Review upheld',
	})
}

/** Strikes not reversed: inside the window, and in all. */
export async function strike_counts(db: Db, user_id: string, now = Date.now()) {
	const live = and(
		eq(moderationAction.targetUserId, user_id),
		eq(moderationAction.strike, true),
		isNull(moderationAction.reversedAt),
	)
	const since = new Date(now - STRIKE_WINDOW_DAYS * DAY)
	const [[recent], [total]] = await db.batch([
		db
			.select({ n: count() })
			.from(moderationAction)
			.where(and(live, gte(moderationAction.createdAt, since))),
		db.select({ n: count() }).from(moderationAction).where(live),
	])
	return { recent: recent?.n ?? 0, total: total?.n ?? 0 }
}

/** An account's actions, newest first, for the moderator's view of it. */
export function account_history(db: Db, user_id: string, limit = 50) {
	return db
		.select({
			id: moderationAction.id,
			action: moderationAction.action,
			reason: moderationAction.reason,
			strike: moderationAction.strike,
			note: moderationAction.note,
			expires_at: moderationAction.expiresAt,
			created_at: moderationAction.createdAt,
			reversed_at: moderationAction.reversedAt,
		})
		.from(moderationAction)
		.where(eq(moderationAction.targetUserId, user_id))
		.orderBy(desc(moderationAction.createdAt))
		.limit(limit)
}

/**
 * File a request to review the suspension `action_id`. One per action: a second returns false.
 * Scoped to the requester in the `where`, so nobody can file against someone else's suspension.
 */
export async function request_review(db: Db, user_id: string, action_id: string, body: string) {
	const [own] = await db
		.select({ id: moderationAction.id })
		.from(moderationAction)
		.where(
			and(
				eq(moderationAction.id, action_id),
				eq(moderationAction.targetUserId, user_id),
				eq(moderationAction.action, 'suspend'),
			),
		)
		.limit(1)
	if (!own) return false
	const inserted = await db
		.insert(appeal)
		.values({ actionId: action_id, userId: user_id, body })
		.onConflictDoNothing()
		.returning({ id: appeal.id })
	return inserted.length > 0
}

/** A suspension's note from the moderator, and the review request filed against it, if any. */
export async function find_suspension_details(db: Db, user_id: string, action_id: string) {
	const [row] = await db
		.select({ note: moderationAction.note, review: appeal.status })
		.from(moderationAction)
		.leftJoin(appeal, eq(appeal.actionId, moderationAction.id))
		.where(and(eq(moderationAction.id, action_id), eq(moderationAction.targetUserId, user_id)))
		.limit(1)
	return { note: row?.note ?? undefined, review: row?.review ?? undefined }
}
