import { and, asc, desc, eq, inArray, ne, notInArray, sql } from 'drizzle-orm'
import { VAPID_PRIVATE_KEY, VAPID_SUBJECT } from '$app/env/private'
import { VAPID_PUBLIC_KEY } from '$app/env/public'
import type { Face } from '#lib/notifications/push-icon'
import type { NotificationType } from '#lib/notifications/types'
import { m } from '#lib/paraglide/messages.js'
import { isLocale, localizeHref, type Locale } from '#lib/paraglide/runtime'
import type { getDb } from './db'
import {
	conversation,
	conversationMember,
	post,
	profile,
	pushSubscription,
	user,
} from './db/schema'
import { shown_image } from './account-image'
import { blocked_between, visible_posts } from './safety'
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
	delivered?: boolean
	/** Who it's from, for the icon: one person, or the two a group's avatar shows. */
	faces?: Face[]
}

/** Moderation notices are written straight to the list and never pushed. */
type Event = {
	user_id: string
	actor_id: string
	type: Exclude<NotificationType, 'moderation'>
	post_id?: string
	conversation_id?: string
	group_name?: string
}

const TITLES = {
	like: m.push_like,
	follow: m.push_follow,
	reply: m.push_reply,
	mention: m.push_mention,
	follow_request: m.push_follow_request,
	repost: m.push_repost,
	quote: m.push_quote,
} as const

/** A group with no name of its own is "a group". */
const GROUP_TITLES = {
	group_add: { named: m.push_group_add, unnamed: m.push_group_add_unnamed },
	group_remove: { named: m.push_group_remove, unnamed: m.push_group_remove_unnamed },
} as const

function title(event: Event, name: string, locale: Locale) {
	if (event.type !== 'group_add' && event.type !== 'group_remove')
		return TITLES[event.type]({ name }, { locale })
	const titles = GROUP_TITLES[event.type]
	return event.group_name
		? titles.named({ name, group: event.group_name }, { locale })
		: titles.unnamed({ name }, { locale })
}

async function readable(db: Db, events: Event[]) {
	const wanted = new Map<string, Set<string>>()
	for (const event of events) {
		if (!event.post_id) continue
		const ids = wanted.get(event.user_id) ?? new Set()
		wanted.set(event.user_id, ids.add(event.post_id))
	}
	const seen = new Set<string>()
	await Promise.all(
		[...wanted].map(async ([viewer, ids]) => {
			const rows = await db
				.select({ id: post.id })
				.from(post)
				.leftJoin(profile, eq(profile.userId, post.authorId))
				.where(and(inArray(post.id, [...ids]), visible_posts(viewer)))
			for (const row of rows) seen.add(`${viewer}:${row.id}`)
		}),
	)
	return events.filter((event) => !event.post_id || seen.has(`${event.user_id}:${event.post_id}`))
}

const face = (person: { id: string; name: string; image: string | null }): Face => ({
	name: person.name,
	seed: person.id,
	image: person.image ?? undefined,
})

const snippet = (text: string) => (text.length > 140 ? `${text.slice(0, 139)}…` : text)

/**
 * Send a push for each new notification to every browser its recipient turned push on for, in
 * that browser's language. Failures never reach the person who acted; expired subscriptions are
 * dropped.
 */
export async function push_notifications(db: Db, all: Event[]) {
	const keys = vapid_keys()
	if (!keys || !all.length) return

	const subscriptions = await db
		.select()
		.from(pushSubscription)
		.where(inArray(pushSubscription.userId, [...new Set(all.map((event) => event.user_id))]))
	if (!subscriptions.length) return
	const events = await readable(
		db,
		all.filter((event) => subscriptions.some((row) => row.userId === event.user_id)),
	)
	if (!events.length) return

	const actor_ids = [...new Set(events.map((event) => event.actor_id))]
	const actors = new Map(
		(
			await db
				.select({
					id: user.id,
					name: sql<string>`coalesce(${profile.displayName}, ${user.name})`,
					handle: profile.handle,
					image: shown_image,
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

	await send_all(
		db,
		keys,
		events.flatMap((event) => {
			const actor = actors.get(event.actor_id)
			if (!actor) return []
			const body = event.post_id ? posts.get(event.post_id) : undefined
			const path =
				event.type === 'follow_request'
					? '/settings/privacy'
					: event.type === 'follow'
						? actor.handle
							? `/u/${encodeURIComponent(actor.handle)}`
							: '/notifications'
						: event.type === 'group_add'
							? `/messages/${encodeURIComponent(event.conversation_id ?? '')}`
							: event.type === 'group_remove'
								? '/notifications'
								: `/p/${encodeURIComponent(event.post_id ?? '')}`
			return subscriptions
				.filter((subscription) => subscription.userId === event.user_id)
				.map((subscription) => {
					const locale = isLocale(subscription.locale) ? subscription.locale : 'en'
					return {
						subscription,
						message: {
							title: title(event, actor.name, locale),
							faces: [face(actor)],
							body: body ? snippet(body) : undefined,
							url: localizeHref(path, { locale }),
							tag:
								event.type === 'like' || event.type === 'repost'
									? `${event.type}:${event.post_id}`
									: `${event.type}:${event.actor_id}:${event.post_id ?? event.conversation_id ?? ''}`,
						},
					}
				})
		}),
	)
}

const DM_PUSH_MAX = 100

export async function push_direct_message(
	db: Db,
	sent: { conversation_id: string; sender_id: string; body: string; photo: boolean },
) {
	const keys = vapid_keys()
	if (!keys) return

	const subscriptions = await db
		.select({
			endpoint: pushSubscription.endpoint,
			p256dh: pushSubscription.p256dh,
			auth: pushSubscription.auth,
			locale: pushSubscription.locale,
			user_id: pushSubscription.userId,
		})
		.from(conversationMember)
		.innerJoin(pushSubscription, eq(pushSubscription.userId, conversationMember.userId))
		.where(
			and(
				eq(conversationMember.conversationId, sent.conversation_id),
				ne(conversationMember.userId, sent.sender_id),
				// In a group, a member who blocked or muted the sender hears nothing from them.
				sql`not ${blocked_between(sent.sender_id, conversationMember.userId)}`,
				sql`not exists(select 1 from mute m where m.muter_id = ${conversationMember.userId} and m.muted_id = ${sent.sender_id})`,
			),
		)
		.limit(DM_PUSH_MAX)
	if (!subscriptions.length) return

	const [about] = await db
		.select({
			name: sql<string>`coalesce(${profile.displayName}, ${user.name})`,
			image: shown_image,
			group: conversation.isGroup,
			group_name: conversation.name,
		})
		.from(conversation)
		.innerJoin(user, eq(user.id, sent.sender_id))
		.leftJoin(profile, eq(profile.userId, user.id))
		.where(eq(conversation.id, sent.conversation_id))
		.limit(1)
	if (!about) return

	// A group's icon is its avatar in the app: its first two members other than the reader. Three
	// in join order always hold two who aren't the reader.
	const members = about.group
		? await db
				.select({
					id: user.id,
					name: sql<string>`coalesce(${profile.displayName}, ${user.name})`,
					image: shown_image,
				})
				.from(conversationMember)
				.innerJoin(user, eq(user.id, conversationMember.userId))
				.leftJoin(profile, eq(profile.userId, conversationMember.userId))
				.where(eq(conversationMember.conversationId, sent.conversation_id))
				.orderBy(asc(conversationMember.createdAt), asc(user.id))
				.limit(3)
		: []
	const sender = face({ id: sent.sender_id, ...about })
	const faces_for = (reader: string) => {
		const pair = members.filter((member) => member.id !== reader).slice(0, 2)
		return pair.length === 2 ? pair.map(face) : [sender]
	}

	await send_all(
		db,
		keys,
		subscriptions.map((subscription) => {
			const locale = isLocale(subscription.locale) ? subscription.locale : 'en'
			return {
				subscription,
				message: {
					title:
						about.group && about.group_name
							? m.push_message_group({ name: about.name, group: about.group_name }, { locale })
							: about.name,
					body: sent.body
						? snippet(sent.body)
						: sent.photo
							? m.dm_photo({}, { locale })
							: undefined,
					url: localizeHref(`/messages/${sent.conversation_id}`, { locale }),
					tag: `dm:${sent.conversation_id}`,
					delivered: true,
					faces: faces_for(subscription.user_id),
				},
			}
		}),
	)
}

async function send_all(
	db: Db,
	keys: VapidKeys,
	jobs: { subscription: PushTarget; message: PushMessage }[],
) {
	const gone: string[] = []
	await Promise.all(
		jobs.map(async ({ subscription, message }) => {
			try {
				const result = await send_push(subscription, JSON.stringify(message), keys)
				if (result === 'gone') gone.push(subscription.endpoint)
			} catch (error) {
				console.error('Push failed', error)
			}
		}),
	)
	if (gone.length) {
		await db.delete(pushSubscription).where(inArray(pushSubscription.endpoint, gone))
	}
}
