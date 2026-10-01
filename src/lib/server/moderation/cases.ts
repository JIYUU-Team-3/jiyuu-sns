import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { is_rule, is_severe, type Rule } from '#lib/moderation/rules'
import type { getDb } from '../db'
import { appeal, message, moderationAction, moderationCase, post, profile } from '../db/schema'

type Db = ReturnType<typeof getDb>

export type TargetKind = 'post' | 'profile' | 'message'
export type Target = { kind: TargetKind; id: string; user_id: string }

/** How much one report raises a case, and a severe rule on top. */
const REPORT_WEIGHT = 1
const SEVERE_WEIGHT = 50

/**
 * Open a case on `target`, or add to the one it has, reopening it if it was closed. Each call
 * raises its priority by `weight`; `flags` merge into the automatic results it keeps.
 */
export async function raise_case(
	db: Db,
	target: Target,
	input: { reason?: Rule; weight: number; report?: boolean; flags?: Record<string, unknown> },
) {
	const flags = JSON.stringify(input.flags ?? {})
	const weight = input.weight + (input.reason && is_severe(input.reason) ? SEVERE_WEIGHT : 0)
	const [row] = await db
		.insert(moderationCase)
		.values({
			targetKind: target.kind,
			targetId: target.id,
			targetUserId: target.user_id,
			priority: weight,
			reports: input.report ? 1 : 0,
			reason: input.reason ?? null,
			flags,
		})
		.onConflictDoUpdate({
			target: [moderationCase.targetKind, moderationCase.targetId],
			set: {
				status: 'open',
				closedAt: null,
				priority: sql`${moderationCase.priority} + ${weight}`,
				reports: sql`${moderationCase.reports} + ${input.report ? 1 : 0}`,
				reason: sql`coalesce(${moderationCase.reason}, ${input.reason ?? null})`,
				flags: sql`json_patch(${moderationCase.flags}, ${flags})`,
				updatedAt: new Date(),
			},
		})
		.returning({ id: moderationCase.id })
	return row.id
}

/**
 * What the report feature (#21) calls after saving a report. #21 owns the `report` table and the
 * buttons; this only puts the target in the moderator's queue. `reason` that isn't one of the
 * rules still counts, unnamed.
 */
export async function on_report(
	db: Db,
	report: { target_kind: TargetKind; target_id: string; target_user_id: string; reason: string },
) {
	// A reported post is checked again, every image included, to set its place in the queue.
	if (report.target_kind === 'post') {
		const { check_posts_later } = await import('./after-write')
		check_posts_later(db, [report.target_id], 'report')
	}
	return raise_case(
		db,
		{ kind: report.target_kind, id: report.target_id, user_id: report.target_user_id },
		{
			reason: is_rule(report.reason) ? report.reason : undefined,
			weight: REPORT_WEIGHT,
			report: true,
		},
	)
}

/** Close a case without acting on it. */
export async function dismiss_case(db: Db, moderator_id: string, case_id: string) {
	const now = new Date()
	const [closed] = await db
		.update(moderationCase)
		.set({ status: 'dismissed', closedAt: now, updatedAt: now })
		.where(and(eq(moderationCase.id, case_id), eq(moderationCase.status, 'open')))
		.returning({ kind: moderationCase.targetKind, id: moderationCase.targetId })
	if (!closed) return false
	await db.insert(moderationAction).values({
		caseId: case_id,
		moderatorId: moderator_id,
		action: 'dismiss',
		targetKind: closed.kind,
		targetId: closed.id,
	})
	return true
}

/** Mark a case acted on; the action itself is recorded by whoever acted. */
export async function close_case(db: Db, case_id: string) {
	const now = new Date()
	await db
		.update(moderationCase)
		.set({ status: 'actioned', closedAt: now, updatedAt: now })
		.where(eq(moderationCase.id, case_id))
}

export type CaseView = {
	id: string
	kind: TargetKind
	target_id: string
	priority: number
	reports: number
	reason: Rule | undefined
	flags: Record<string, unknown>
	updated_at: number
	author: { id: string; handle: string | undefined; name: string | undefined } | undefined
	/** The post's or message's text, or the profile's bio; undefined once it's gone. */
	text: string | undefined
	/** Whether the content still exists. */
	exists: boolean
}

/** Text shown in the queue is cut to this; the full post is one click away. */
const EXCERPT_MAX = 500

/** The open queue, highest priority first, each case with enough to judge it at a glance. */
export async function open_cases(db: Db, limit = 50): Promise<CaseView[]> {
	const cases = await db
		.select()
		.from(moderationCase)
		.where(eq(moderationCase.status, 'open'))
		.orderBy(desc(moderationCase.priority), desc(moderationCase.updatedAt))
		.limit(limit)

	const ids = (kind: TargetKind) =>
		cases.filter((c) => c.targetKind === kind).map((c) => c.targetId)
	const users = [...new Set(cases.map((c) => c.targetUserId).filter((id) => id !== null))]
	const none = <T>() => Promise.resolve([] as T[])

	const [posts, messages, profiles] = await Promise.all([
		ids('post').length
			? db
					.select({ id: post.id, text: post.body })
					.from(post)
					.where(inArray(post.id, ids('post')))
			: none<{ id: string; text: string }>(),
		// Only the reported message itself, never the conversation around it.
		ids('message').length
			? db
					.select({ id: message.id, text: message.body })
					.from(message)
					.where(inArray(message.id, ids('message')))
			: none<{ id: string; text: string }>(),
		users.length
			? db
					.select({
						id: profile.userId,
						handle: profile.handle,
						name: profile.displayName,
						bio: profile.bio,
					})
					.from(profile)
					.where(inArray(profile.userId, users))
			: none<{ id: string; handle: string; name: string; bio: string }>(),
	])
	const text = new Map([...posts, ...messages].map((row) => [row.id, row.text]))
	const people = new Map(profiles.map((row) => [row.id, row]))

	return cases.map((row) => {
		const person = row.targetUserId ? people.get(row.targetUserId) : undefined
		const body = row.targetKind === 'profile' ? person?.bio : text.get(row.targetId)
		return {
			id: row.id,
			kind: row.targetKind,
			target_id: row.targetId,
			priority: row.priority,
			reports: row.reports,
			reason: is_rule(row.reason) ? row.reason : undefined,
			flags: JSON.parse(row.flags) as Record<string, unknown>,
			updated_at: row.updatedAt.getTime(),
			author: row.targetUserId
				? { id: row.targetUserId, handle: person?.handle, name: person?.name }
				: undefined,
			text: body?.slice(0, EXCERPT_MAX),
			exists: row.targetKind === 'profile' ? !!person : text.has(row.targetId),
		}
	})
}

export type ReviewView = {
	id: string
	body: string
	created_at: number
	action: {
		id: string
		action: string
		reason: string | null
		expires_at: number | null
		target_kind: string
		target_id: string
	}
	author: { id: string; handle: string | undefined }
}

/** Requests to undo an action that nobody has decided yet, oldest first. */
export async function open_reviews(db: Db, limit = 50): Promise<ReviewView[]> {
	const rows = await db
		.select({
			id: appeal.id,
			body: appeal.body,
			created_at: appeal.createdAt,
			action_id: moderationAction.id,
			action: moderationAction.action,
			reason: moderationAction.reason,
			expires_at: moderationAction.expiresAt,
			target_kind: moderationAction.targetKind,
			target_id: moderationAction.targetId,
			user_id: appeal.userId,
			handle: profile.handle,
		})
		.from(appeal)
		.innerJoin(moderationAction, eq(moderationAction.id, appeal.actionId))
		.leftJoin(profile, eq(profile.userId, appeal.userId))
		.where(eq(appeal.status, 'open'))
		.orderBy(appeal.createdAt)
		.limit(limit)
	return rows.map((row) => ({
		id: row.id,
		body: row.body,
		created_at: row.created_at.getTime(),
		action: {
			id: row.action_id,
			action: row.action,
			reason: row.reason,
			expires_at: row.expires_at?.getTime() ?? null,
			target_kind: row.target_kind,
			target_id: row.target_id,
		},
		author: { id: row.user_id, handle: row.handle ?? undefined },
	}))
}

/** Settle an open review request. Returns what it was about, so the caller can undo it. */
export async function decide_review(
	db: Db,
	moderator_id: string,
	appeal_id: string,
	upheld: boolean,
) {
	const [decided] = await db
		.update(appeal)
		.set({ status: upheld ? 'upheld' : 'refused', decidedBy: moderator_id, decidedAt: new Date() })
		.where(and(eq(appeal.id, appeal_id), eq(appeal.status, 'open')))
		.returning({ action_id: appeal.actionId, user_id: appeal.userId })
	if (!decided) return undefined
	const [action] = await db
		.select({
			action: moderationAction.action,
			target_kind: moderationAction.targetKind,
			target_id: moderationAction.targetId,
		})
		.from(moderationAction)
		.where(eq(moderationAction.id, decided.action_id))
		.limit(1)
	return action && { ...action, user_id: decided.user_id, action_id: decided.action_id }
}
