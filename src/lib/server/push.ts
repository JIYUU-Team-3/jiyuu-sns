import { and, desc, eq, inArray, notInArray, sql } from 'drizzle-orm'
import { VAPID_PRIVATE_KEY, VAPID_SUBJECT } from '$app/env/private'
import { VAPID_PUBLIC_KEY } from '$app/env/public'
import type { NotificationType } from '#lib/notifications/types'
import { m } from '#lib/paraglide/messages.js'
import { isLocale, localizeHref, type Locale } from '#lib/paraglide/runtime'
import type { getDb } from './db'
import { post, profile, pushSubscription, user } from './db/schema'
import { send_push, type PushTarget, type VapidKeys } from './web-push'

type Db = ReturnType<typeof getDb>

/** The keys, or undefined when push isn't configured for this deployment. */
export function vapid_keys(): VapidKeys | undefined {
	if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return undefined
	return {
		public_key: VAPID_PUBLIC_KEY,
		private_key: VAPID_PRIVATE_KEY,
		subject: VAPID_SUBJECT || 'mailto:jiyuu.org@gmail.com',
	}
}

/** More browsers than anyone signs in on; every one costs a request per notification. */
const SUBSCRIPTIONS_MAX = 10

/**
 * Remember a browser for this account. The same browser signing in as someone else moves over.
 * Past `SUBSCRIPTIONS_MAX`, the account's oldest ones are forgotten.
 */
export async function save_subscription(
	db: Db,
	user_id: string,
	target: PushTarget,
	locale: Locale,
) {
	await db
		.insert(pushSubscription)
		.values({
			endpoint: target.endpoint,
			userId: user_id,
			p256dh: target.p256dh,
			auth: target.auth,
			locale,
		})
		.onConflictDoUpdate({
			target: pushSubscription.endpoint,
			set: { userId: user_id, p256dh: target.p256dh, auth: target.auth, locale },
		})
	await db
		.delete(pushSubscription)
		.where(
			and(
				eq(pushSubscription.userId, user_id),
				notInArray(
					pushSubscription.endpoint,
					db
						.select({ endpoint: pushSubscription.endpoint })
						.from(pushSubscription)
						.where(eq(pushSubscription.userId, user_id))
						.orderBy(desc(pushSubscription.createdAt))
						.limit(SUBSCRIPTIONS_MAX),
				),
			),
		)
}

export async function remove_subscription(db: Db, user_id: string, endpoint: string) {
	await db
		.delete(pushSubscription)
		.where(and(eq(pushSubscription.endpoint, endpoint), eq(pushSubscription.userId, user_id)))
}

/** What the service worker needs to show one notification. */
export type PushMessage = {
	title: string
	body?: string
	/** Where a click goes. */
	url: string
	/** Notifications with the same tag replace each other, e.g. likes on one post. */
	tag: string
}

type Event = { user_id: string; actor_id: string; type: NotificationType; post_id?: string }

const TITLES = {
	like: m.push_like,
	follow: m.push_follow,
	reply: m.push_reply,
	mention: m.push_mention,
} as const

const snippet = (text: string) => (text.length > 140 ? `${text.slice(0, 139)}…` : text)

/**
 * Send a push for each new notification to every browser its recipient turned push on for, in
 * that browser's language. Failures never reach the person who acted; expired subscriptions are
 * dropped.
 */
export async function push_notifications(db: Db, events: Event[]) {
	const keys = vapid_keys()
	if (!keys || !events.length) return

	const recipients = [...new Set(events.map((event) => event.user_id))]
	const subscriptions = await db
		.select()
		.from(pushSubscription)
		.where(inArray(pushSubscription.userId, recipients))
	if (!subscriptions.length) return

	const actor_ids = [...new Set(events.map((event) => event.actor_id))]
	const actors = new Map(
		(
			await db
				.select({
					id: user.id,
					name: sql<string>`coalesce(${profile.displayName}, ${user.name})`,
					handle: profile.handle,
				})
				.from(user)
				.leftJoin(profile, eq(profile.userId, user.id))
				.where(inArray(user.id, actor_ids))
		).map((row) => [row.id, row]),
	)
	const post_ids = [...new Set(events.flatMap((event) => (event.post_id ? [event.post_id] : [])))]
	const posts = new Map(
		post_ids.length
			? (
					await db
						.select({ id: post.id, body: post.body })
						.from(post)
						.where(inArray(post.id, post_ids))
				).map((row) => [row.id, row.body])
			: [],
	)

	const gone: string[] = []
	await Promise.all(
		events.flatMap((event) => {
			const actor = actors.get(event.actor_id)
			if (!actor) return []
			const body = event.post_id ? posts.get(event.post_id) : undefined
			const path =
				event.type === 'follow'
					? actor.handle
						? `/u/${encodeURIComponent(actor.handle)}`
						: '/notifications'
					: `/p/${encodeURIComponent(event.post_id ?? '')}`
			return subscriptions
				.filter((subscription) => subscription.userId === event.user_id)
				.map(async (subscription) => {
					const locale = isLocale(subscription.locale) ? subscription.locale : 'en'
					const message: PushMessage = {
						title: TITLES[event.type]({ name: actor.name }, { locale }),
						body: body ? snippet(body) : undefined,
						url: localizeHref(path, { locale }),
						tag:
							event.type === 'like'
								? `like:${event.post_id}`
								: `${event.type}:${event.actor_id}:${event.post_id ?? ''}`,
					}
					try {
						const result = await send_push(subscription, JSON.stringify(message), keys)
						if (result === 'gone') gone.push(subscription.endpoint)
					} catch (error) {
						console.error('Push failed', error)
					}
				})
		}),
	)
	if (gone.length) {
		await db.delete(pushSubscription).where(inArray(pushSubscription.endpoint, gone))
	}
}
