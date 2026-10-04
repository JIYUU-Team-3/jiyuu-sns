import { env, waitUntil } from 'cloudflare:workers'
import { and, desc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm'
import {
	CARD_TYPES,
	type NotificationPage,
	type NotificationTab,
	type NotificationType,
	type NotificationView,
} from '#lib/notifications/types'
import { shown_image } from './account-image'
import { seen_recently } from './cache'
import type { getDb } from './db'
import { chunks } from './db/chunks'
import { appeal, conversation, moderationAction, notification, profile, user } from './db/schema'
import { is_rule } from '#lib/moderation/rules'
import { nudge_inboxes } from './live'
import { find_posts } from './posts'
import { push_notifications } from './push'
import { actor_shown, silenced } from './safety'

type Db = ReturnType<typeof getDb>

export const PAGE_SIZE = 20

type NewNotification = {
	user_id: string
	actor_id: string
	/** Moderation notices are written by `server/moderation/posts.ts`, without a push. */
	type: Exclude<NotificationType, 'moderation'>
	post_id?: string
	/** For `group_add` and `group_remove`: the group, and what it was called then. */
	conversation_id?: string
	group_name?: string
}

/** Each row binds seven values, and D1 takes 100 per statement. */
const ROWS_PER_INSERT = 10

/** Record notifications, skipping any about your own action, and push them to their browsers. */
export async function notify(db: Db, rows: NewNotification[]) {
	const others = rows.filter((row) => row.user_id !== row.actor_id)
	const quiet = await silenced(db, others)
	const events = others.filter((row) => !quiet.has(`${row.user_id}:${row.actor_id}`))
	if (!events.length) return
	for (const rows of chunks(events, ROWS_PER_INSERT)) {
		await db.insert(notification).values(
			rows.map((row) => ({
				userId: row.user_id,
				actorId: row.actor_id,
				type: row.type,
				postId: row.post_id ?? null,
				conversationId: row.conversation_id ?? null,
				groupName: row.group_name ?? null,
			})),
		)
	}
	// Open tabs hear at once, over the socket their message badge already listens on.
	waitUntil(nudge_unread(events.map((event) => event.user_id)))
	// Pushes go out after the response, so a slow push service never delays a like or a post.
	waitUntil(
		not_just_pushed(events)
			.then((fresh) => push_notifications(db, fresh))
			.catch((error) => console.error('Push failed', error)),
	)
}

/** Tell these people's open tabs that their unread count changed. Never fails the write it follows. */
function nudge_unread(user_ids: string[]) {
	let chat: DurableObjectNamespace | undefined
	try {
		chat = (env as Partial<Pick<Env, 'CHAT'>>).CHAT
	} catch {
		// Outside a Worker (a unit test) there are no rooms to tell.
		return Promise.resolve()
	}
	return nudge_inboxes(chat, user_ids, 'notification').catch((error) =>
		console.error('Notification update failed', error),
	)
}

const GROUP_TYPES = ['group_add', 'group_remove'] as const

/** Few enough ids that the block lookup in `notify` stays under D1's 100 parameters. */
const GROUP_USERS_PER_NOTIFY = 30

/**
 * Tell `user_ids` that `actor_id` put them in a group chat, or took them out of it. Whatever was
 * said before about them and that group is replaced, so adding and removing someone over and
 * over leaves one line. The caller has already made the change, and so checked the actor's right
 * to make it; a direct chat has nobody to add or remove, and notifies nobody.
 */
export async function notify_group(
	db: Db,
	actor_id: string,
	conversation_id: string,
	type: (typeof GROUP_TYPES)[number],
	user_ids: string[],
) {
	const [group] = await db
		.select({ name: conversation.name })
		.from(conversation)
		.where(and(eq(conversation.id, conversation_id), eq(conversation.isGroup, true)))
		.limit(1)
	if (!group) return
	for (const ids of chunks([...new Set(user_ids)], GROUP_USERS_PER_NOTIFY)) {
		await db
			.delete(notification)
			.where(
				and(
					inArray(notification.userId, ids),
					eq(notification.conversationId, conversation_id),
					inArray(notification.type, [...GROUP_TYPES]),
				),
			)
		await notify(
			db,
			ids.map((user_id) => ({
				user_id,
				actor_id,
				type,
				conversation_id,
				group_name: group.name ?? undefined,
			})),
		)
	}
}

/** How long the same like, repost or follow stays quiet after it was pushed once. */
const REPEAT_QUIET_SECONDS = 60 * 60

/**
 * Likes, reposts and follows can be undone and redone, and each redo is a new notification.
 * Pushing every one would let someone buzz a phone by toggling a like, so the same one is pushed
 * once an hour at most; the list still shows it. Adding someone to a group and removing them
 * again is the same kind of toggle.
 */
const TOGGLED: NotificationType[] = ['like', 'repost', 'follow', ...GROUP_TYPES]

async function not_just_pushed(events: NewNotification[]) {
	const fresh: NewNotification[] = []
	for (const event of events) {
		// Kept per location in the Cache API, not KV: a like is a write, and the free plan's 1,000
		// KV writes a day would run out. Someone toggling a like stays in one location anyway.
		const key = `pushed:${event.type}:${event.actor_id}:${event.user_id}:${event.post_id ?? event.conversation_id ?? ''}`
		if (TOGGLED.includes(event.type) && (await seen_recently(key, REPEAT_QUIET_SECONDS))) continue
		fresh.push(event)
	}
	return fresh
}

/**
 * Take back what an undone action announced: an unlike removes the like notification, an
 * unfollow the follow one, an undone repost the repost one, so toggling never piles up
 * duplicates.
 */
export async function retract(db: Db, row: NewNotification) {
	await db
		.delete(notification)
		.where(
			and(
				eq(notification.userId, row.user_id),
				eq(notification.actorId, row.actor_id),
				eq(notification.type, row.type),
				row.post_id ? eq(notification.postId, row.post_id) : isNull(notification.postId),
			),
		)
	waitUntil(nudge_unread([row.user_id]))
}

/** Unread notifications, counted up to 100 so a busy account never scans its whole history. */
export async function unread_count(db: Db, user_id: string) {
	const [row] = await db.all<{ n: number }>(
		sql`select count(*) as n from (
			select 1 from notification n where n.user_id = ${user_id} and n.read_at is null
			and not exists(select 1 from mute m where m.muter_id = ${user_id} and m.muted_id = n.actor_id)
			limit 100
		)`,
	)
	return row?.n ?? 0
}

export async function mark_read(db: Db, user_id: string) {
	await db
		.update(notification)
		.set({ readAt: new Date() })
		.where(and(eq(notification.userId, user_id), isNull(notification.readAt)))
}

function decode_cursor(cursor: string | undefined) {
	if (!cursor) return undefined
	const at = cursor.indexOf(':')
	const time = Number(cursor.slice(0, at))
	if (at < 1 || !Number.isSafeInteger(time)) return undefined
	return { created_at: new Date(time), id: cursor.slice(at + 1) }
}

/**
 * The account's notifications, newest first. Replies, mentions and quotes carry the whole post so
 * the list can show it as a card; likes and reposts carry only its text.
 */
export async function notifications_page(
	db: Db,
	user_id: string,
	tab: NotificationTab,
	cursor: string | undefined,
): Promise<NotificationPage> {
	const at = decode_cursor(cursor)
	const rows = await db
		.select({
			id: notification.id,
			type: notification.type,
			post_id: notification.postId,
			read_at: notification.readAt,
			created_at: notification.createdAt,
			actor_id: user.id,
			actor_name: sql<string>`coalesce(${profile.displayName}, ${user.name})`,
			actor_handle: profile.handle,
			actor_image: shown_image,
			post_body: sql<
				string | null
			>`(select p.body from post p where p.id = ${notification.postId})`,
			// Only someone still in the group gets a way into it.
			conversation_id: sql<string | null>`(
				select cm.conversation_id from conversation_member cm
				where cm.conversation_id = ${notification.conversationId} and cm.user_id = ${user_id}
			)`,
			group_name: notification.groupName,
			action: moderationAction.action,
			reason: moderationAction.reason,
			review: appeal.status,
		})
		.from(notification)
		.innerJoin(user, eq(user.id, notification.actorId))
		.leftJoin(moderationAction, eq(moderationAction.id, notification.actionId))
		.leftJoin(appeal, eq(appeal.actionId, notification.actionId))
		.leftJoin(profile, eq(profile.userId, notification.actorId))
		.where(
			and(
				eq(notification.userId, user_id),
				actor_shown(user_id),
				tab === 'mentions' ? inArray(notification.type, ['reply', 'mention']) : undefined,
				at
					? or(
							lt(notification.createdAt, at.created_at),
							and(eq(notification.createdAt, at.created_at), lt(notification.id, at.id)),
						)
					: undefined,
			),
		)
		.orderBy(desc(notification.createdAt), desc(notification.id))
		.limit(PAGE_SIZE + 1)

	const shown = rows.slice(0, PAGE_SIZE)
	const post_ids = shown.flatMap((row) =>
		CARD_TYPES.includes(row.type) && row.post_id ? [row.post_id] : [],
	)
	const posts = new Map((await find_posts(db, user_id, post_ids, true)).map((p) => [p.id, p]))

	const items = shown.flatMap((row): NotificationView[] => {
		const post = row.post_id ? posts.get(row.post_id) : undefined
		// A reply, mention or quote whose post is gone has nothing left to show.
		if (CARD_TYPES.includes(row.type) && !post) return []
		return [
			{
				id: row.id,
				type: row.type,
				created_at: row.created_at.getTime(),
				unread: row.read_at === null,
				actor: {
					id: row.actor_id,
					name: row.actor_name,
					handle: row.actor_handle ?? undefined,
					image: row.actor_image ?? undefined,
				},
				post_id: row.post_id ?? undefined,
				snippet: CARD_TYPES.includes(row.type) ? undefined : (row.post_body ?? undefined),
				post,
				group:
					row.type === 'group_add' || row.type === 'group_remove'
						? { id: row.conversation_id ?? undefined, name: row.group_name ?? undefined }
						: undefined,
				moderation:
					row.type === 'moderation' &&
					(row.action === 'remove' || row.action === 'limit' || row.action === 'restore')
						? {
								action: row.action,
								reason: is_rule(row.reason) ? row.reason : undefined,
								review_refused: row.review === 'refused',
							}
						: undefined,
			},
		]
	})
	const last = shown.at(-1)
	return {
		items,
		next: rows.length > PAGE_SIZE && last ? `${last.created_at.getTime()}:${last.id}` : undefined,
	}
}
