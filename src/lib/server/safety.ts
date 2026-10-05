import { and, desc, eq, inArray, or, sql, type SQL, type SQLWrapper } from 'drizzle-orm'
import { MUTED_TERMS_MAX, type ReportReason } from '#lib/safety/rules'
import type { Account, SafetyLists } from '#lib/safety/types'
import { shown_image } from './account-image'
import type { getDb } from './db'
import {
	block,
	follow,
	followRequest,
	mute,
	mutedTerm,
	notification,
	post,
	profile,
	user,
} from './db/schema'

type Db = ReturnType<typeof getDb>

export const LIST_MAX = 500

type Side = SQLWrapper | string

export const blocked_between = (a: Side, b: Side) =>
	sql`exists(select 1 from block b where (b.blocker_id = ${a} and b.blocked_id = ${b}) or (b.blocker_id = ${b} and b.blocked_id = ${a}))`

const follows = (follower: Side, following: Side) =>
	sql`exists(select 1 from follow f where f.follower_id = ${follower} and f.following_id = ${following})`

/**
 * The moderation half of who may see a post: anyone while it's visible; only its author once a
 * moderator limits or removes it. Moderators look at hidden posts through `/mod/p/[id]`, so nothing
 * here needs to know about roles. `visible_posts` includes it; use it alone only where the author's
 * profile isn't joined and blocks and privacy don't apply.
 */
export function shown_to(viewer: string | undefined) {
	const visible = eq(post.moderation, 'visible')
	return viewer ? or(visible, eq(post.authorId, viewer)) : visible
}

/**
 * Whether the viewer may see what `account` puts out: not across a block, and not a private
 * account's unless the viewer follows it. `is_private` is that account's `profile.is_private`.
 */
export function open_to(viewer: string | undefined, account: Side, is_private: SQLWrapper) {
	const open = sql`coalesce(${is_private}, 0) = 0`
	if (!viewer) return open
	return and(
		sql`not ${blocked_between(viewer, account)}`,
		or(sql`${account} = ${viewer}`, open, follows(viewer, account)),
	)
}

/**
 * Who may see a post, and the one filter every query that lists posts includes: not hidden by a
 * moderator (`shown_to`), and `open_to` the viewer. Needs the author's `profile` joined.
 */
export function visible_posts(viewer: string | undefined) {
	return and(shown_to(viewer), open_to(viewer, post.authorId, profile.isPrivate))
}

/**
 * `visible_posts` for a post outside the query's own `post` and `profile`, such as the one a post
 * quotes, given as that post's author, moderation state and author's private flag.
 */
export function visible_post(
	viewer: string | undefined,
	of: { author: SQLWrapper; moderation: SQLWrapper; is_private: SQLWrapper },
) {
	const shown = viewer
		? sql`(${of.moderation} = 'visible' or ${of.author} = ${viewer})`
		: sql`${of.moderation} = 'visible'`
	return and(shown, open_to(viewer, of.author, of.is_private))
}

/** Not an account the viewer muted; the viewer's own always passes. */
export const unmuted_account = (viewer: string | undefined, account: Side) =>
	viewer
		? sql`(${account} = ${viewer} or not exists(select 1 from mute m where m.muter_id = ${viewer} and m.muted_id = ${account}))`
		: undefined

export function unmuted_posts(viewer: string | undefined) {
	if (!viewer) return undefined
	return sql`(${post.authorId} = ${viewer} or (
		not exists(select 1 from mute m where m.muter_id = ${viewer} and m.muted_id = ${post.authorId})
		and not exists(select 1 from muted_term t where t.user_id = ${viewer} and case
			when substr(t.term, 1, 1) = '#' then exists(
				select 1 from post_tag pt where pt.post_id = ${post.id} and pt.tag = substr(t.term, 2)
			)
			else instr(lower(${post.body}), t.term) > 0
		end)
	))`
}

export const visible_people = (viewer: string | undefined) =>
	viewer ? sql`not ${blocked_between(viewer, profile.userId)}` : undefined

export async function is_blocked(db: Db, a: string, b: string) {
	const [row] = await db.all<{ yes: number }>(sql`select ${blocked_between(a, b)} as yes`)
	return !!row?.yes
}

async function account_id(db: Db, me: string, handle: string) {
	const [row] = await db
		.select({ id: profile.userId })
		.from(profile)
		.where(eq(profile.handle, handle))
		.limit(1)
	return row && row.id !== me ? row.id : undefined
}

const between = <T extends { userId: SQLWrapper }>(
	table: T,
	other: SQLWrapper,
	a: string,
	b: string,
) => or(and(eq(table.userId, a), eq(other, b)), and(eq(table.userId, b), eq(other, a)))

export async function set_block(db: Db, me: string, handle: string, on: boolean) {
	const them = await account_id(db, me, handle)
	if (!them) return false
	if (!on) {
		await db.delete(block).where(and(eq(block.blockerId, me), eq(block.blockedId, them)))
		return true
	}
	await db.batch([
		db.insert(block).values({ blockerId: me, blockedId: them }).onConflictDoNothing(),
		db
			.delete(follow)
			.where(
				or(
					and(eq(follow.followerId, me), eq(follow.followingId, them)),
					and(eq(follow.followerId, them), eq(follow.followingId, me)),
				),
			),
		db
			.delete(followRequest)
			.where(
				or(
					and(eq(followRequest.requesterId, me), eq(followRequest.targetId, them)),
					and(eq(followRequest.requesterId, them), eq(followRequest.targetId, me)),
				),
			),
		db.delete(notification).where(between(notification, notification.actorId, me, them)),
	])
	return true
}

export async function set_mute(db: Db, me: string, handle: string, on: boolean) {
	const them = await account_id(db, me, handle)
	if (!them) return false
	if (on) await db.insert(mute).values({ muterId: me, mutedId: them }).onConflictDoNothing()
	else await db.delete(mute).where(and(eq(mute.muterId, me), eq(mute.mutedId, them)))
	return true
}

export async function add_muted_term(db: Db, me: string, term: string) {
	const added = await db.all(
		sql`insert or ignore into muted_term (user_id, term)
			select ${me}, ${term}
			where (select count(*) from muted_term where user_id = ${me}) < ${MUTED_TERMS_MAX}
			returning term`,
	)
	if (added.length) return 'added'
	const [held] = await db
		.select({ term: mutedTerm.term })
		.from(mutedTerm)
		.where(and(eq(mutedTerm.userId, me), eq(mutedTerm.term, term)))
		.limit(1)
	return held ? 'added' : 'full'
}

export async function remove_muted_term(db: Db, me: string, term: string) {
	await db.delete(mutedTerm).where(and(eq(mutedTerm.userId, me), eq(mutedTerm.term, term)))
}

const account_fields = {
	id: profile.userId,
	handle: profile.handle,
	name: profile.displayName,
	image: shown_image,
}

const to_account = (row: { image: string | null } & Omit<Account, 'image'>): Account => ({
	...row,
	image: row.image ?? undefined,
})

export async function safety_lists(db: Db, me: string): Promise<SafetyLists> {
	const accounts = () =>
		db.select(account_fields).from(profile).innerJoin(user, eq(user.id, profile.userId))
	const [blocked, muted, terms, requests, [mine]] = await Promise.all([
		accounts()
			.innerJoin(block, and(eq(block.blockedId, profile.userId), eq(block.blockerId, me)))
			.orderBy(desc(block.createdAt))
			.limit(LIST_MAX),
		accounts()
			.innerJoin(mute, and(eq(mute.mutedId, profile.userId), eq(mute.muterId, me)))
			.orderBy(desc(mute.createdAt))
			.limit(LIST_MAX),
		db
			.select({ term: mutedTerm.term })
			.from(mutedTerm)
			.where(eq(mutedTerm.userId, me))
			.orderBy(desc(mutedTerm.createdAt))
			.limit(MUTED_TERMS_MAX),
		accounts()
			.innerJoin(
				followRequest,
				and(eq(followRequest.requesterId, profile.userId), eq(followRequest.targetId, me)),
			)
			.orderBy(desc(followRequest.createdAt))
			.limit(LIST_MAX),
		db.select({ private: profile.isPrivate }).from(profile).where(eq(profile.userId, me)).limit(1),
	])
	return {
		blocked: blocked.map(to_account),
		muted: muted.map(to_account),
		terms: terms.map((row) => row.term),
		requests: requests.map(to_account),
		private: !!mine?.private,
	}
}

const approve_requests = (db: Db, where: SQL | undefined) =>
	db
		.insert(follow)
		.select(
			db
				.select({
					followerId: followRequest.requesterId,
					followingId: followRequest.targetId,
					notifyPosts: sql<boolean>`0`.as('notify_posts'),
					createdAt: sql<Date>`cast(unixepoch('subsecond') * 1000 as integer)`.as('created_at'),
				})
				.from(followRequest)
				.where(where),
		)
		.onConflictDoNothing()

export async function answer_request(db: Db, me: string, handle: string, approve: boolean) {
	const them = await account_id(db, me, handle)
	if (!them) return false
	const remove = db
		.delete(followRequest)
		.where(and(eq(followRequest.requesterId, them), eq(followRequest.targetId, me)))
		.returning({ id: followRequest.requesterId })
	const clear = db
		.delete(notification)
		.where(
			and(
				eq(notification.userId, me),
				eq(notification.actorId, them),
				eq(notification.type, 'follow_request'),
			),
		)
	const removed = approve
		? (
				await db.batch([
					approve_requests(
						db,
						and(
							eq(followRequest.requesterId, them),
							eq(followRequest.targetId, me),
							sql`not ${blocked_between(them, me)}`,
						),
					),
					remove,
					clear,
				])
			)[1]
		: (await db.batch([remove, clear]))[0]
	return removed.length > 0
}

export async function set_private(db: Db, me: string, on: boolean) {
	const update = db.update(profile).set({ isPrivate: on }).where(eq(profile.userId, me))
	if (on) {
		await update
		return
	}
	await db.batch([
		update,
		approve_requests(
			db,
			and(
				eq(followRequest.targetId, me),
				sql`not ${blocked_between(followRequest.requesterId, followRequest.targetId)}`,
			),
		),
		db.delete(followRequest).where(eq(followRequest.targetId, me)),
		db
			.delete(notification)
			.where(and(eq(notification.userId, me), eq(notification.type, 'follow_request'))),
	])
}

export type NewReport = {
	handle: string
	post_id?: string
	reason: ReportReason
	note: string
}

/**
 * Save a report. False when there's nobody or no such post to report; otherwise who it's about,
 * and whether it's new: a person reports the same thing once, so a repeat saves nothing.
 */
export async function save_report(db: Db, me: string, input: NewReport) {
	const them = await account_id(db, me, input.handle)
	if (!them) return false
	if (input.post_id) {
		const [owned] = await db
			.select({ id: post.id })
			.from(post)
			.where(and(eq(post.id, input.post_id), eq(post.authorId, them)))
			.limit(1)
		if (!owned) return false
	}
	const post_id = input.post_id ?? null
	const saved = await db.all(
		sql`insert into report (id, reporter_id, user_id, post_id, reason, note)
			select ${crypto.randomUUID()}, ${me}, ${them}, ${post_id}, ${input.reason}, ${input.note}
			where not exists(
				select 1 from report where reporter_id = ${me} and user_id = ${them} and post_id is ${post_id}
			)
			returning id`,
	)
	return { user_id: them, fresh: saved.length > 0 }
}

export async function silenced(db: Db, pairs: { user_id: string; actor_id: string }[]) {
	if (!pairs.length) return new Set<string>()
	const users = [...new Set(pairs.map((pair) => pair.user_id))]
	const actors = [...new Set(pairs.map((pair) => pair.actor_id))]
	const [blocks, mutes] = await Promise.all([
		db
			.select({ a: block.blockerId, b: block.blockedId })
			.from(block)
			.where(
				or(
					and(inArray(block.blockerId, users), inArray(block.blockedId, actors)),
					and(inArray(block.blockerId, actors), inArray(block.blockedId, users)),
				),
			),
		db
			.select({ a: mute.muterId, b: mute.mutedId })
			.from(mute)
			.where(and(inArray(mute.muterId, users), inArray(mute.mutedId, actors))),
	])
	const quiet = new Set<string>()
	for (const row of blocks) quiet.add(`${row.a}:${row.b}`).add(`${row.b}:${row.a}`)
	for (const row of mutes) quiet.add(`${row.a}:${row.b}`)
	return quiet
}

export const actor_shown = (viewer: string) =>
	sql`not ${blocked_between(viewer, notification.actorId)} and not exists(select 1 from mute m where m.muter_id = ${viewer} and m.muted_id = ${notification.actorId})`
