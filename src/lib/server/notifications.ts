import { env, waitUntil } from 'cloudflare:workers'
import { and, desc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm'
import type {
	NotificationPage,
	NotificationTab,
	NotificationType,
	NotificationView,
} from '#lib/notifications/types'
import { shown_image } from './account-image'
import type { getDb } from './db'
import { notification, profile, user } from './db/schema'
import { find_posts } from './posts'
import { push_notifications } from './push'
import { actor_shown, silenced } from './safety'

type Db = ReturnType<typeof getDb>

export const PAGE_SIZE = 20

type NewNotification = {
	user_id: string
	actor_id: string
	type: NotificationType
	post_id?: string
}

/** Record notifications, skipping any about your own action, and push them to their browsers. */
export async function notify(db: Db, rows: NewNotification[]) {
	const others = rows.filter((row) => row.user_id !== row.actor_id)
	const quiet = await silenced(db, others)
	const events = others.filter((row) => !quiet.has(`${row.user_id}:${row.actor_id}`))
	if (!events.length) return
	await db.insert(notification).values(
		events.map((row) => ({
			userId: row.user_id,
			actorId: row.actor_id,
			type: row.type,
			postId: row.post_id ?? null,
		})),
	)
	// Pushes go out after the response, so a slow push service never delays a like or a post.
	waitUntil(
		not_just_pushed(events)
			.then((fresh) => push_notifications(db, fresh))
			.catch((error) => console.error('Push failed', error)),
	)
}

/** How long the same like or follow stays quiet after it was pushed once. */
const REPEAT_QUIET_SECONDS = 60 * 60

/**
 * Likes and follows can be undone and redone, and each redo is a new notification. Pushing every
 * one would let someone buzz a phone by toggling a like, so the same like or follow is pushed
 * once an hour at most; the list still shows it.
 */
async function not_just_pushed(events: NewNotification[]) {
	const kv: KVNamespace | undefined = env.KV
	if (!kv) return events
	const fresh: NewNotification[] = []
	for (const event of events) {
		if (event.type === 'like' || event.type === 'follow') {
			const key = `pushed:${event.type}:${event.actor_id}:${event.user_id}:${event.post_id ?? ''}`
			if (await kv.get(key)) continue
			await kv.put(key, '1', { expirationTtl: REPEAT_QUIET_SECONDS })
		}
		fresh.push(event)
	}
	return fresh
}

/**
 * Take back what an undone action announced: an unlike removes the like notification, an
 * unfollow the follow one, so toggling never piles up duplicates.
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
 * The account's notifications, newest first. Replies and mentions carry the whole post so the
 * list can show it as a card; likes carry only its text.
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
		})
		.from(notification)
		.innerJoin(user, eq(user.id, notification.actorId))
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
		(row.type === 'reply' || row.type === 'mention') && row.post_id ? [row.post_id] : [],
	)
	const posts = new Map((await find_posts(db, user_id, post_ids, true)).map((p) => [p.id, p]))

	const items = shown.flatMap((row): NotificationView[] => {
		const post = row.post_id ? posts.get(row.post_id) : undefined
		// A reply or mention whose post is gone has nothing left to show.
		if ((row.type === 'reply' || row.type === 'mention') && !post) return []
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
				snippet: row.type === 'like' ? (row.post_body ?? undefined) : undefined,
				post,
			},
		]
	})
	const last = shown.at(-1)
	return {
		items,
		next: rows.length > PAGE_SIZE && last ? `${last.created_at.getTime()}:${last.id}` : undefined,
	}
}
