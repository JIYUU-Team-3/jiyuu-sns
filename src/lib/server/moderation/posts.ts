import { and, desc, eq, inArray, isNull, lt, notExists, sql } from 'drizzle-orm'
import { is_rule, strike_outcome, type Rule } from '#lib/moderation/rules'
import type { getDb } from '../db'
import {
	appeal,
	moderationAction,
	moderationCase,
	notification,
	post,
	postMedia,
	profile,
} from '../db/schema'
import { remove_post, unused_uploads } from '../posts'
import { strike_counts, suspend } from './standing'

type Db = ReturnType<typeof getDb>

/** How long a removed post is kept so its author can ask for a review. */
export const REMOVED_KEPT_MS = 24 * 60 * 60 * 1000

export type PostAction = 'sensitive' | 'unsensitive' | 'limit' | 'remove' | 'restore'

/** What a moderator sees of one post, whatever its state. */
export async function post_for_review(db: Db, id: string) {
	const [row] = await db
		.select({
			id: post.id,
			body: post.body,
			author_id: post.authorId,
			handle: profile.handle,
			name: profile.displayName,
			moderation: post.moderation,
			sensitive: post.sensitive,
			removed_at: post.removedAt,
			created_at: post.createdAt,
			reply_to_id: post.replyToId,
		})
		.from(post)
		.leftJoin(profile, eq(profile.userId, post.authorId))
		.where(eq(post.id, id))
		.limit(1)
	if (!row) return undefined
	const [media, history] = await Promise.all([
		db
			.select({ kind: postMedia.kind, url: postMedia.url, alt: postMedia.alt })
			.from(postMedia)
			.where(eq(postMedia.postId, id))
			.orderBy(postMedia.position),
		db
			.select({
				id: moderationAction.id,
				action: moderationAction.action,
				reason: moderationAction.reason,
				strike: moderationAction.strike,
				created_at: moderationAction.createdAt,
				reversed_at: moderationAction.reversedAt,
			})
			.from(moderationAction)
			.where(and(eq(moderationAction.targetKind, 'post'), eq(moderationAction.targetId, id)))
			.orderBy(desc(moderationAction.createdAt)),
	])
	return { ...row, media, history }
}

/** Tell an author what a moderator did to their post. Not pushed: it's news, not a ping. */
async function tell_author(
	db: Db,
	author_id: string,
	actor_id: string | null,
	action_id: string,
	post_id: string,
) {
	await db.insert(notification).values({
		userId: author_id,
		// An automatic action has no moderator; the row needs an actor, and the author is never shown.
		actorId: actor_id ?? author_id,
		type: 'moderation',
		postId: post_id,
		actionId: action_id,
	})
}

/**
 * Act on a post. `remove` with `strike` counts against the author and may suspend them, per the
 * strike rules. Any action but `restore` and `unsensitive` closes the post's open case. Returns
 * undefined when the post doesn't exist, or the state it's already in.
 */
export async function moderate_post(
	db: Db,
	input: {
		moderator_id: string | null
		post_id: string
		action: PostAction
		reason?: Rule
		strike?: boolean
		note?: string
	},
) {
	const [target] = await db
		.select({ author_id: post.authorId, moderation: post.moderation, sensitive: post.sensitive })
		.from(post)
		.where(eq(post.id, input.post_id))
		.limit(1)
	if (!target) return undefined

	const now = new Date()
	const changes: Partial<typeof post.$inferInsert> =
		input.action === 'sensitive'
			? { sensitive: true }
			: input.action === 'unsensitive'
				? { sensitive: false }
				: input.action === 'limit'
					? { moderation: 'limited' }
					: input.action === 'remove'
						? { moderation: 'removed', removedAt: now }
						: { moderation: 'visible', removedAt: null }
	const unchanged =
		(input.action === 'sensitive' && target.sensitive) ||
		(input.action === 'unsensitive' && !target.sensitive) ||
		(input.action === 'limit' && target.moderation === 'limited') ||
		(input.action === 'remove' && target.moderation === 'removed') ||
		(input.action === 'restore' && target.moderation === 'visible')
	if (unchanged) return undefined

	const action_id = crypto.randomUUID()
	const strike = input.action === 'remove' && !!input.strike
	const closes = input.action !== 'restore' && input.action !== 'unsensitive'
	await db.batch([
		db.update(post).set(changes).where(eq(post.id, input.post_id)),
		db.insert(moderationAction).values({
			id: action_id,
			moderatorId: input.moderator_id,
			action: input.action === 'unsensitive' ? 'restore' : input.action,
			reason: input.reason ?? null,
			strike,
			targetKind: 'post',
			targetId: input.post_id,
			targetUserId: target.author_id,
			note: input.note || null,
		}),
		// Restoring takes back the removal or limit, and with it any strike it carried.
		...(input.action === 'restore'
			? [
					db
						.update(moderationAction)
						.set({ reversedAt: now })
						.where(
							and(
								eq(moderationAction.targetKind, 'post'),
								eq(moderationAction.targetId, input.post_id),
								inArray(moderationAction.action, ['remove', 'limit']),
								isNull(moderationAction.reversedAt),
							),
						),
				]
			: []),
		...(closes
			? [
					db
						.update(moderationCase)
						.set({ status: 'actioned', closedAt: now, updatedAt: now })
						.where(
							and(
								eq(moderationCase.targetKind, 'post'),
								eq(moderationCase.targetId, input.post_id),
								eq(moderationCase.status, 'open'),
							),
						),
				]
			: []),
	])

	if (input.action === 'remove' || input.action === 'limit' || input.action === 'restore') {
		await tell_author(db, target.author_id, input.moderator_id, action_id, input.post_id)
	}

	let suspended: 'suspend' | 'ban' | undefined
	if (strike && input.reason) {
		const counts = await strike_counts(db, target.author_id)
		const outcome = strike_outcome(input.reason, counts.recent, counts.total)
		if (outcome.kind !== 'warning') {
			const days = outcome.kind === 'ban' ? null : outcome.days
			await suspend(db, {
				moderator_id: input.moderator_id,
				user_id: target.author_id,
				reason: input.reason,
				days,
			})
			suspended = outcome.kind
		}
	}
	return { action_id, suspended }
}

/** The removal or limit in force on a post, for its author's notice. */
export async function post_notice(db: Db, author_id: string, post_id: string) {
	const [row] = await db
		.select({
			action_id: moderationAction.id,
			action: moderationAction.action,
			reason: moderationAction.reason,
			note: moderationAction.note,
			removed_at: post.removedAt,
			review: appeal.status,
		})
		.from(moderationAction)
		.innerJoin(post, eq(post.id, moderationAction.targetId))
		.leftJoin(appeal, eq(appeal.actionId, moderationAction.id))
		.where(
			and(
				eq(moderationAction.targetKind, 'post'),
				eq(moderationAction.targetId, post_id),
				eq(moderationAction.targetUserId, author_id),
				eq(post.authorId, author_id),
				inArray(moderationAction.action, ['remove', 'limit']),
				isNull(moderationAction.reversedAt),
			),
		)
		.orderBy(desc(moderationAction.createdAt))
		.limit(1)
	if (!row) return undefined
	const review_until =
		row.action === 'remove' && row.removed_at ? row.removed_at.getTime() + REMOVED_KEPT_MS : null
	return {
		action_id: row.action_id,
		action: row.action as 'remove' | 'limit',
		reason: is_rule(row.reason) ? row.reason : undefined,
		note: row.note ?? undefined,
		review: row.review ?? undefined,
		/** Until when a review can be asked for; null for a limit, which a moderator reviews anyway. */
		review_until,
	}
}

/**
 * Ask for a review of a post's removal, inside the day it's kept. Scoped to the author in the
 * `where`; one request per removal.
 */
export async function request_post_review(
	db: Db,
	author_id: string,
	post_id: string,
	body: string,
	now = Date.now(),
) {
	const notice = await post_notice(db, author_id, post_id)
	if (!notice || notice.action !== 'remove' || notice.review_until === null) return false
	if (now > notice.review_until) return false
	const inserted = await db
		.insert(appeal)
		.values({ actionId: notice.action_id, userId: author_id, body })
		.onConflictDoNothing()
		.returning({ id: appeal.id })
	return inserted.length > 0
}

/**
 * Delete for good the removed posts whose day has passed with no review pending, or whose review
 * was refused, with their uploads. Returns the uploads no other post still uses, for the caller to
 * delete from R2. Capped per run, so one run's cost has a ceiling; the next run takes the rest.
 */
export async function purge_removed_posts(db: Db, now = Date.now(), limit = 100) {
	const pending = db
		.select({ id: appeal.id })
		.from(appeal)
		.innerJoin(moderationAction, eq(moderationAction.id, appeal.actionId))
		.where(
			and(
				eq(moderationAction.targetKind, 'post'),
				eq(moderationAction.targetId, post.id),
				eq(appeal.status, 'open'),
			),
		)
	const due = await db
		.select({ id: post.id, author_id: post.authorId })
		.from(post)
		.where(
			and(
				eq(post.moderation, 'removed'),
				lt(post.removedAt, new Date(now - REMOVED_KEPT_MS)),
				notExists(pending),
			),
		)
		.limit(limit)
	// One post at a time: a post holds at most a few uploads, well inside D1's parameter limit.
	const unused: string[] = []
	for (const row of due) {
		const removed = await remove_post(db, row.author_id, row.id)
		if (removed) unused.push(...(await unused_uploads(db, removed.uploads)))
	}
	return { purged: due.length, unused }
}

/** Delete one removed post now, after a refused review. */
export async function purge_post(db: Db, post_id: string) {
	const [row] = await db
		.select({ author_id: post.authorId })
		.from(post)
		.where(and(eq(post.id, post_id), eq(post.moderation, 'removed')))
		.limit(1)
	if (!row) return []
	const removed = await remove_post(db, row.author_id, post_id)
	return removed ? unused_uploads(db, removed.uploads) : []
}

/** Whether `url` is on a post that `viewer` may see, for serving media of hidden posts. */
export async function media_shown_to(db: Db, url: string, viewer: string) {
	const [row] = await db
		.select({ one: sql<number>`1` })
		.from(postMedia)
		.innerJoin(post, eq(post.id, postMedia.postId))
		.where(
			and(
				eq(postMedia.url, url),
				sql`(${post.moderation} = 'visible' or ${post.authorId} = ${viewer})`,
			),
		)
		.limit(1)
	return !!row
}
