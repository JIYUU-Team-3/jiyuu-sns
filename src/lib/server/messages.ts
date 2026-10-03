import { and, asc, desc, eq, inArray, isNotNull, isNull, ne, or, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import type {
	ConversationPage,
	ConversationView,
	GroupEventKind,
	LastMessage,
	MemberRole,
	MessageMedia,
	MessagePage,
	MessageView,
	Reaction,
	Receipt,
} from '#lib/messages/types'
import { direct_key, MEMBER_MAX } from '#lib/messages/rules'
import { shown_image } from './account-image'
import { media_key } from './media'
import type { getDb } from './db'
import { chunks } from './db/chunks'
import { blocked_between, is_blocked } from './safety'
import {
	conversation,
	conversationMember,
	message,
	messageReaction,
	profile,
	user,
} from './db/schema'
import { blocked_hosts_in } from './moderation/links'

type Db = ReturnType<typeof getDb>

export const CONVERSATION_PAGE = 20
export const MESSAGE_PAGE = 30

/** Event rows bind more values each than member rows do. */
const EVENTS_PER_INSERT = 10

/**
 * The statements that write a group's own lines into its chat: `me` did `kind`, to each of
 * `targets` where there are any. They leave `lastMessageAt` alone, so a line never marks the chat
 * unread or becomes its preview in the inbox.
 */
function insert_events(
	db: Db,
	conversation_id: string,
	me: string,
	kind: GroupEventKind,
	targets: (string | null)[] = [null],
	body = '',
) {
	return chunks(targets, EVENTS_PER_INSERT).map((ids) =>
		db.insert(message).values(
			ids.map((targetId) => ({
				conversationId: conversation_id,
				senderId: me,
				event: kind,
				targetId,
				body,
			})),
		),
	)
}

/** Each member row binds three values, and D1 takes 100 per statement. */
const MEMBERS_PER_INSERT = 30

/** The statements that put `user_ids` in a conversation; whoever is `owner` gets that role. */
function insert_members(db: Db, conversation_id: string, user_ids: string[], owner?: string) {
	return chunks(user_ids, MEMBERS_PER_INSERT).map((ids) =>
		db
			.insert(conversationMember)
			.values(
				ids.map((userId) => ({
					conversationId: conversation_id,
					userId,
					role: userId === owner ? ('owner' as const) : ('member' as const),
				})),
			)
			.onConflictDoNothing(),
	)
}

function decode_cursor(cursor: string | undefined) {
	if (!cursor) return undefined
	const at = cursor.indexOf(':')
	const time = Number(cursor.slice(0, at))
	if (at < 1 || !Number.isSafeInteger(time)) return undefined
	return { time, id: cursor.slice(at + 1) }
}

const display_name = sql<string>`coalesce(${profile.displayName}, ${user.name})`
const avatar = shown_image

export async function is_member(db: Db, user_id: string, conversation_id: string) {
	const [row] = await db
		.select({ id: conversationMember.conversationId })
		.from(conversationMember)
		.where(
			and(
				eq(conversationMember.conversationId, conversation_id),
				eq(conversationMember.userId, user_id),
			),
		)
		.limit(1)
	return !!row
}

export async function member_ids(db: Db, conversation_id: string) {
	const rows = await db
		.select({ id: conversationMember.userId })
		.from(conversationMember)
		.where(eq(conversationMember.conversationId, conversation_id))
		.limit(MEMBER_MAX)
	return rows.map((row) => row.id)
}

type ConversationRow = {
	id: string
	name: string | null
	image: string | null
	is_group: boolean
	role: MemberRole
	last_read_at: Date | null
	last_message_at: Date | null
	created_at: Date
}

const updated_at = sql<number>`coalesce(${conversation.lastMessageAt}, ${conversation.createdAt})`

function select_conversations(db: Db) {
	return db
		.select({
			id: conversation.id,
			name: conversation.name,
			image: conversation.image,
			is_group: conversation.isGroup,
			role: conversationMember.role,
			last_read_at: conversationMember.lastReadAt,
			last_message_at: conversation.lastMessageAt,
			created_at: conversation.createdAt,
		})
		.from(conversationMember)
		.innerJoin(conversation, eq(conversation.id, conversationMember.conversationId))
		.$dynamic()
}

async function to_views(db: Db, me: string, rows: ConversationRow[]): Promise<ConversationView[]> {
	if (!rows.length) return []
	const ids = rows.map((row) => row.id)

	const [members, lasts] = await Promise.all([
		db
			.select({
				conversation_id: conversationMember.conversationId,
				id: user.id,
				name: display_name,
				handle: profile.handle,
				image: avatar,
				joined: sql<number>`${user.createdAt}`,
				role: conversationMember.role,
			})
			.from(conversationMember)
			.innerJoin(user, eq(user.id, conversationMember.userId))
			.leftJoin(profile, eq(profile.userId, conversationMember.userId))
			.where(
				and(inArray(conversationMember.conversationId, ids), ne(conversationMember.userId, me)),
			)
			.orderBy(asc(conversationMember.createdAt), asc(user.id)),
		db
			.select({
				conversation_id: message.conversationId,
				sender_id: message.senderId,
				sender_name: display_name,
				body: message.body,
				media_kind: message.mediaKind,
				created_at: message.createdAt,
			})
			.from(message)
			.innerJoin(
				conversation,
				and(
					eq(conversation.id, message.conversationId),
					eq(conversation.lastMessageAt, message.createdAt),
				),
			)
			.innerJoin(user, eq(user.id, message.senderId))
			.leftJoin(profile, eq(profile.userId, message.senderId))
			.where(inArray(message.conversationId, ids))
			.orderBy(asc(message.id)),
	])

	const by_conversation = new Map<string, typeof members>()
	for (const member of members) {
		const list = by_conversation.get(member.conversation_id) ?? []
		list.push(member)
		by_conversation.set(member.conversation_id, list)
	}
	const last_by_conversation = new Map(
		lasts.map((row): [string, LastMessage] => [
			row.conversation_id,
			{
				sender_name: row.sender_name,
				mine: row.sender_id === me,
				body: row.body,
				media_kind: row.media_kind ?? undefined,
				created_at: row.created_at.getTime(),
			},
		]),
	)

	return rows.map((row) => {
		const last_message = row.last_message_at?.getTime()
		return {
			id: row.id,
			name: row.name ?? undefined,
			// Only ever one of our own uploads; `set_group_image` is the one place that writes it.
			image: media_key(row.image) ? (row.image ?? undefined) : undefined,
			group: row.is_group,
			role: row.role,
			members: (by_conversation.get(row.id) ?? []).map((member) => ({
				id: member.id,
				name: member.name,
				handle: member.handle ?? undefined,
				image: member.image ?? undefined,
				joined: member.joined,
				role: member.role,
			})),
			last: last_by_conversation.get(row.id),
			unread: last_message !== undefined && last_message > (row.last_read_at?.getTime() ?? 0),
			updated_at: last_message ?? row.created_at.getTime(),
		}
	})
}

export async function conversations_page(
	db: Db,
	me: string,
	cursor: string | undefined,
): Promise<ConversationPage> {
	const at = decode_cursor(cursor)
	const rows = await select_conversations(db)
		.where(
			and(
				eq(conversationMember.userId, me),
				// A direct chat nobody has written in yet is only in its starter's inbox, so opening
				// one doesn't put it in the other person's. A group shows for everyone at once.
				or(
					isNotNull(conversation.lastMessageAt),
					eq(conversation.createdBy, me),
					eq(conversation.isGroup, true),
				),
				at
					? or(
							sql`${updated_at} < ${at.time}`,
							and(sql`${updated_at} = ${at.time}`, sql`${conversation.id} < ${at.id}`),
						)
					: undefined,
			),
		)
		.orderBy(desc(updated_at), desc(conversation.id))
		.limit(CONVERSATION_PAGE + 1)

	const shown = rows.slice(0, CONVERSATION_PAGE)
	const items = await to_views(db, me, shown)
	const last = items.at(-1)
	return {
		items,
		next: rows.length > CONVERSATION_PAGE && last ? `${last.updated_at}:${last.id}` : undefined,
	}
}

export async function find_conversation(db: Db, me: string, id: string) {
	const rows = await select_conversations(db)
		.where(and(eq(conversationMember.userId, me), eq(conversation.id, id)))
		.limit(1)
	const [view] = await to_views(db, me, rows)
	return view
}

export async function messages_page(
	db: Db,
	me: string,
	conversation_id: string,
	cursor: string | undefined,
): Promise<MessagePage | undefined> {
	if (!(await is_member(db, me, conversation_id))) return undefined
	const at = decode_cursor(cursor)
	const parent = alias(message, 'parent')
	const parent_user = alias(user, 'parent_user')
	const parent_profile = alias(profile, 'parent_profile')
	const target_user = alias(user, 'target_user')
	const target_profile = alias(profile, 'target_profile')

	const rows = await db
		.select({
			id: message.id,
			sender_id: message.senderId,
			sender_name: display_name,
			sender_handle: profile.handle,
			sender_image: avatar,
			body: message.body,
			event: message.event,
			target_name: sql<string | null>`coalesce(${target_profile.displayName}, ${target_user.name})`,
			blocked_hosts: blocked_hosts_in(message.body),
			media_kind: message.mediaKind,
			media_url: message.mediaUrl,
			media_width: message.mediaWidth,
			media_height: message.mediaHeight,
			created_at: message.createdAt,
			reply_id: parent.id,
			reply_sender_id: parent.senderId,
			reply_sender_name: sql<
				string | null
			>`coalesce(${parent_profile.displayName}, ${parent_user.name})`,
			reply_body: parent.body,
			reply_media_kind: parent.mediaKind,
		})
		.from(message)
		.innerJoin(user, eq(user.id, message.senderId))
		.leftJoin(profile, eq(profile.userId, message.senderId))
		.leftJoin(parent, eq(parent.id, message.replyToId))
		.leftJoin(parent_user, eq(parent_user.id, parent.senderId))
		.leftJoin(parent_profile, eq(parent_profile.userId, parent.senderId))
		.leftJoin(target_user, eq(target_user.id, message.targetId))
		.leftJoin(target_profile, eq(target_profile.userId, message.targetId))
		.where(
			and(
				eq(message.conversationId, conversation_id),
				at
					? or(
							sql`${message.createdAt} < ${at.time}`,
							and(sql`${message.createdAt} = ${at.time}`, sql`${message.id} < ${at.id}`),
						)
					: undefined,
			),
		)
		.orderBy(desc(message.createdAt), desc(message.id))
		.limit(MESSAGE_PAGE + 1)

	const shown = rows.slice(0, MESSAGE_PAGE)
	const [reactions, receipts] = await Promise.all([
		reactions_for(
			db,
			me,
			shown.map((row) => row.id),
		),
		at ? [] : receipts_for(db, me, conversation_id),
	])

	const items = shown.map((row): MessageView => ({
		id: row.id,
		sender: {
			id: row.sender_id,
			name: row.sender_name,
			handle: row.sender_handle ?? undefined,
			image: row.sender_image ?? undefined,
		},
		mine: row.sender_id === me,
		event: row.event ? { kind: row.event, target: row.target_name ?? undefined } : undefined,
		body: row.body,
		blocked_hosts: JSON.parse(row.blocked_hosts) as string[],
		media: to_media(row),
		reply_to: row.reply_id
			? {
					id: row.reply_id,
					sender_name: row.reply_sender_name ?? '',
					mine: row.reply_sender_id === me,
					body: row.reply_body ?? '',
					media_kind: row.reply_media_kind ?? undefined,
				}
			: undefined,
		reactions: reactions.get(row.id) ?? [],
		created_at: row.created_at.getTime(),
	}))
	const last = shown.at(-1)
	return {
		items,
		receipts,
		next:
			rows.length > MESSAGE_PAGE && last ? `${last.created_at.getTime()}:${last.id}` : undefined,
	}
}

async function receipts_for(db: Db, me: string, conversation_id: string): Promise<Receipt[]> {
	const rows = await db
		.select({
			user_id: conversationMember.userId,
			read_at: conversationMember.lastReadAt,
			delivered_at: conversationMember.lastDeliveredAt,
		})
		.from(conversationMember)
		.where(
			and(
				eq(conversationMember.conversationId, conversation_id),
				ne(conversationMember.userId, me),
			),
		)
	return rows.map((row) => ({
		user_id: row.user_id,
		read_at: row.read_at?.getTime(),
		delivered_at: row.delivered_at?.getTime(),
	}))
}

function to_media(row: {
	media_kind: 'image' | 'gif' | null
	media_url: string | null
	media_width: number | null
	media_height: number | null
}): MessageMedia | undefined {
	// The check on the kind is for rows from when messages briefly took other files.
	if (!row.media_url || (row.media_kind !== 'image' && row.media_kind !== 'gif')) return undefined
	return {
		kind: row.media_kind,
		url: row.media_url,
		width: row.media_width ?? 1,
		height: row.media_height ?? 1,
	}
}

async function reactions_for(db: Db, me: string, ids: string[]) {
	const result = new Map<string, Reaction[]>()
	if (!ids.length) return result
	const rows = await db
		.select({
			message_id: messageReaction.messageId,
			emoji: messageReaction.emoji,
			count: sql<number>`count(*)`,
			mine: sql<number>`max(${messageReaction.userId} = ${me})`,
		})
		.from(messageReaction)
		.where(inArray(messageReaction.messageId, ids))
		.groupBy(messageReaction.messageId, messageReaction.emoji)
		.orderBy(sql`min(${messageReaction.createdAt})`)
	for (const row of rows) {
		const list = result.get(row.message_id) ?? []
		list.push({ emoji: row.emoji, count: row.count, mine: !!row.mine })
		result.set(row.message_id, list)
	}
	return result
}

export type NewMessage = {
	body: string
	media?: MessageMedia
	reply_to?: string
}

export async function send_message(
	db: Db,
	me: string,
	conversation_id: string,
	input: NewMessage,
): Promise<string | 'not_found' | 'blocked'> {
	if (!(await is_member(db, me, conversation_id))) return 'not_found'
	if (await direct_blocked(db, me, conversation_id)) return 'blocked'
	if (input.reply_to) {
		const [target] = await db
			.select({ id: message.id })
			.from(message)
			.where(
				and(
					eq(message.id, input.reply_to),
					eq(message.conversationId, conversation_id),
					isNull(message.event),
				),
			)
			.limit(1)
		if (!target) return 'not_found'
	}
	const id = crypto.randomUUID()
	const now = new Date()
	await db.batch([
		db.insert(message).values({
			id,
			conversationId: conversation_id,
			senderId: me,
			body: input.body,
			replyToId: input.reply_to ?? null,
			mediaKind: input.media?.kind ?? null,
			mediaUrl: input.media?.url ?? null,
			mediaWidth: input.media?.width ?? null,
			mediaHeight: input.media?.height ?? null,
			createdAt: now,
		}),
		db.update(conversation).set({ lastMessageAt: now }).where(eq(conversation.id, conversation_id)),
		db
			.update(conversationMember)
			.set({ lastReadAt: now, lastDeliveredAt: now })
			.where(
				and(
					eq(conversationMember.conversationId, conversation_id),
					eq(conversationMember.userId, me),
				),
			),
	])
	return id
}

async function direct_blocked(db: Db, me: string, conversation_id: string) {
	const [row] = await db
		.select({ id: conversationMember.userId })
		.from(conversationMember)
		.innerJoin(conversation, eq(conversation.id, conversationMember.conversationId))
		.where(
			and(
				eq(conversationMember.conversationId, conversation_id),
				eq(conversation.isGroup, false),
				ne(conversationMember.userId, me),
				blocked_between(me, conversationMember.userId),
			),
		)
		.limit(1)
	return !!row
}

export async function mark_read(db: Db, me: string, conversation_id: string) {
	const now = new Date()
	await db
		.update(conversationMember)
		.set({ lastReadAt: now, lastDeliveredAt: now })
		.where(
			and(
				eq(conversationMember.conversationId, conversation_id),
				eq(conversationMember.userId, me),
			),
		)
}

export async function mark_delivered(db: Db, me: string) {
	const rows = await db
		.update(conversationMember)
		.set({ lastDeliveredAt: new Date() })
		.where(
			and(
				eq(conversationMember.userId, me),
				sql`exists (
					select 1 from ${conversation}
					where ${conversation.id} = ${conversationMember.conversationId}
						and ${conversation.lastMessageAt} > coalesce(${conversationMember.lastDeliveredAt}, 0)
				)`,
			),
		)
		.returning({ id: conversationMember.conversationId })
	return rows.map((row) => row.id)
}

export async function unread_count(db: Db, me: string) {
	const [row] = await db.all<{ n: number }>(
		sql`select count(*) as n from (
			select 1 from conversation_member cm
			join conversation c on c.id = cm.conversation_id
			where cm.user_id = ${me}
				and c.last_message_at is not null
				and (cm.last_read_at is null or cm.last_read_at < c.last_message_at)
			limit 100
		)`,
	)
	return row?.n ?? 0
}

export async function react(
	db: Db,
	me: string,
	message_id: string,
	emoji: string,
): Promise<{ conversation_id: string; reactions: Reaction[] } | undefined> {
	const [target] = await db
		.select({ conversation_id: message.conversationId })
		.from(message)
		.innerJoin(
			conversationMember,
			and(
				eq(conversationMember.conversationId, message.conversationId),
				eq(conversationMember.userId, me),
			),
		)
		.where(and(eq(message.id, message_id), isNull(message.event)))
		.limit(1)
	if (!target) return undefined

	const [current] = await db
		.select({ emoji: messageReaction.emoji })
		.from(messageReaction)
		.where(and(eq(messageReaction.messageId, message_id), eq(messageReaction.userId, me)))
		.limit(1)

	if (current?.emoji === emoji) {
		await db
			.delete(messageReaction)
			.where(and(eq(messageReaction.messageId, message_id), eq(messageReaction.userId, me)))
	} else {
		await db
			.insert(messageReaction)
			.values({ messageId: message_id, userId: me, emoji })
			.onConflictDoUpdate({
				target: [messageReaction.messageId, messageReaction.userId],
				set: { emoji, createdAt: new Date() },
			})
	}
	const reactions = (await reactions_for(db, me, [message_id])).get(message_id) ?? []
	return { conversation_id: target.conversation_id, reactions }
}

export async function start_conversation(
	db: Db,
	me: string,
	user_ids: string[],
	name: string | undefined,
): Promise<string | 'invalid'> {
	const others = [...new Set(user_ids)].filter((id) => id !== me)
	if (!others.length || others.length > MEMBER_MAX - 1) return 'invalid'

	const found = await db
		.select({ id: profile.userId })
		.from(profile)
		.where(inArray(profile.userId, others))
	if (found.length !== others.length) return 'invalid'

	if (others.length === 1) {
		if (await is_blocked(db, me, others[0])) return 'invalid'
		const key = direct_key(me, others[0])
		await db
			.insert(conversation)
			.values({ directKey: key, createdBy: me })
			.onConflictDoNothing({ target: conversation.directKey })
		const [row] = await db
			.select({ id: conversation.id })
			.from(conversation)
			.where(eq(conversation.directKey, key))
			.limit(1)
		if (!row) return 'invalid'
		await db
			.insert(conversationMember)
			.values([me, others[0]].map((userId) => ({ conversationId: row.id, userId })))
			.onConflictDoNothing()
		return row.id
	}

	const id = crypto.randomUUID()
	await db.batch([
		db.insert(conversation).values({ id, name: name || null, isGroup: true, createdBy: me }),
		...insert_members(db, id, [me, ...others], me),
		...insert_events(db, id, me, 'created'),
	])
	return id
}

/** Whether `me` is in the group `conversation_id`; a direct chat has no settings to change. */
const my_group = (me: string, conversation_id: string) =>
	sql`exists(
		select 1 from conversation c
		join conversation_member cm on cm.conversation_id = c.id
		where c.id = ${conversation_id} and c.is_group and cm.user_id = ${me}
	)`

/** The role `me` has in the group `conversation_id`, read in the same statement as the write. */
const my_role = (me: string, conversation_id: string) =>
	sql`(
		select cm.role from conversation_member cm
		join conversation c on c.id = cm.conversation_id
		where cm.conversation_id = ${conversation_id} and cm.user_id = ${me} and c.is_group
	)`

/** Any member can rename their group; an empty name goes back to listing the people in it. */
export async function rename_group(db: Db, me: string, conversation_id: string, name: string) {
	const rows = await db
		.update(conversation)
		.set({ name: name || null })
		.where(and(eq(conversation.id, conversation_id), my_group(me, conversation_id)))
		.returning({ id: conversation.id })
	if (!rows.length) return false
	await db.batch(as_batch(insert_events(db, conversation_id, me, 'renamed', [null], name)))
	return true
}

/**
 * Any member can change their group's photo. Answers with the photo it replaced, so the caller
 * can delete it, or `not_found` for anyone outside that group.
 */
export async function set_group_image(
	db: Db,
	me: string,
	conversation_id: string,
	url: string | undefined,
): Promise<{ replaced?: string } | 'not_found'> {
	const [before] = await db
		.select({ image: conversation.image })
		.from(conversation)
		.where(and(eq(conversation.id, conversation_id), my_group(me, conversation_id)))
		.limit(1)
	if (!before) return 'not_found'
	const rows = await db
		.update(conversation)
		.set({ image: url ?? null })
		.where(and(eq(conversation.id, conversation_id), my_group(me, conversation_id)))
		.returning({ id: conversation.id })
	if (!rows.length) return 'not_found'
	await db.batch(as_batch(insert_events(db, conversation_id, me, 'photo')))
	return { replaced: before.image && before.image !== url ? before.image : undefined }
}

/**
 * Any member can add people, up to `MEMBER_MAX` in the group. Nobody is added who has blocked
 * the person adding them, or been blocked by them. Answers with the ids that joined.
 */
export async function add_members(
	db: Db,
	me: string,
	conversation_id: string,
	user_ids: string[],
): Promise<string[] | 'not_found' | 'invalid' | 'full'> {
	const current = await db
		.select({ id: conversationMember.userId })
		.from(conversationMember)
		.where(
			and(eq(conversationMember.conversationId, conversation_id), my_group(me, conversation_id)),
		)
	if (!current.length) return 'not_found'

	const inside = new Set(current.map((row) => row.id))
	const wanted = [...new Set(user_ids)].filter((id) => !inside.has(id))
	if (!wanted.length) return []
	if (inside.size + wanted.length > MEMBER_MAX) return 'full'

	const found = await db
		.select({ id: profile.userId })
		.from(profile)
		.where(and(inArray(profile.userId, wanted), sql`not ${blocked_between(me, profile.userId)}`))
	if (found.length !== wanted.length) return 'invalid'

	await db.batch(
		as_batch([
			...insert_members(db, conversation_id, wanted),
			...insert_events(db, conversation_id, me, 'added', wanted),
		]),
	)
	return wanted
}

/**
 * Take someone out of a group. The owner can remove anyone else and an admin only plain members
 * (`can_remove` in `rules.ts` says the same to the page); the roles are compared in the delete
 * itself, so a demotion that lands first is honoured.
 */
export async function remove_member(db: Db, me: string, conversation_id: string, user_id: string) {
	const mine = my_role(me, conversation_id)
	const rows = await db
		.delete(conversationMember)
		.where(
			and(
				eq(conversationMember.conversationId, conversation_id),
				eq(conversationMember.userId, user_id),
				ne(conversationMember.userId, me),
				or(
					and(sql`${mine} = 'owner'`, ne(conversationMember.role, 'owner')),
					and(sql`${mine} = 'admin'`, eq(conversationMember.role, 'member')),
				),
			),
		)
		.returning({ id: conversationMember.userId })
	if (!rows.length) return false
	await db.batch(as_batch(insert_events(db, conversation_id, me, 'removed', [user_id])))
	return true
}

/** Only the owner makes a member an admin, or an admin a member again. */
export async function set_admin(
	db: Db,
	me: string,
	conversation_id: string,
	user_id: string,
	on: boolean,
) {
	const rows = await db
		.update(conversationMember)
		.set({ role: on ? 'admin' : 'member' })
		.where(
			and(
				eq(conversationMember.conversationId, conversation_id),
				eq(conversationMember.userId, user_id),
				eq(conversationMember.role, on ? 'member' : 'admin'),
				sql`${my_role(me, conversation_id)} = 'owner'`,
			),
		)
		.returning({ id: conversationMember.userId })
	if (!rows.length) return false
	await db.batch(
		as_batch(insert_events(db, conversation_id, me, on ? 'admin_on' : 'admin_off', [user_id])),
	)
	return true
}

/**
 * The owner hands the group to someone else in it and becomes an admin. Two statements in one
 * transaction: the second only runs its change once the first has made the new owner.
 */
export async function transfer_owner(db: Db, me: string, conversation_id: string, user_id: string) {
	if (user_id === me) return false
	const [promoted] = await db.batch([
		db
			.update(conversationMember)
			.set({ role: 'owner' })
			.where(
				and(
					eq(conversationMember.conversationId, conversation_id),
					eq(conversationMember.userId, user_id),
					sql`${my_role(me, conversation_id)} = 'owner'`,
				),
			)
			.returning({ id: conversationMember.userId }),
		db
			.update(conversationMember)
			.set({ role: 'admin' })
			.where(
				and(
					eq(conversationMember.conversationId, conversation_id),
					eq(conversationMember.userId, me),
					eq(conversationMember.role, 'owner'),
					sql`exists(
						select 1 from conversation_member o
						where o.conversation_id = ${conversation_id}
							and o.user_id = ${user_id} and o.role = 'owner'
					)`,
				),
			),
	])
	if (!promoted.length) return false
	await db.batch(as_batch(insert_events(db, conversation_id, me, 'owner', [user_id])))
	return true
}

/** `db.batch` wants a list it can see is not empty. */
const as_batch = <T>(statements: T[]) => statements as [T, ...T[]]

export async function leave_conversation(db: Db, me: string, conversation_id: string) {
	const [row] = await db
		.select({ is_group: conversation.isGroup })
		.from(conversation)
		.innerJoin(
			conversationMember,
			and(
				eq(conversationMember.conversationId, conversation.id),
				eq(conversationMember.userId, me),
			),
		)
		.where(eq(conversation.id, conversation_id))
		.limit(1)
	if (!row?.is_group) return false

	await db
		.delete(conversationMember)
		.where(
			and(
				eq(conversationMember.conversationId, conversation_id),
				eq(conversationMember.userId, me),
			),
		)
	const [left] = await db
		.select({ id: conversationMember.userId })
		.from(conversationMember)
		.where(eq(conversationMember.conversationId, conversation_id))
		.limit(1)
	if (!left) {
		await db.delete(conversation).where(eq(conversation.id, conversation_id))
		return true
	}
	await db.batch(as_batch(insert_events(db, conversation_id, me, 'left')))
	// A group is never left without an owner: the longest-standing admin takes over, or failing
	// that the longest-standing member.
	await db
		.update(conversationMember)
		.set({ role: 'owner' })
		.where(
			and(
				eq(conversationMember.conversationId, conversation_id),
				sql`not exists(
					select 1 from conversation_member o
					where o.conversation_id = ${conversation_id} and o.role = 'owner'
				)`,
				sql`${conversationMember.userId} = (
					select n.user_id from conversation_member n
					where n.conversation_id = ${conversation_id}
					order by (n.role = 'admin') desc, n.created_at, n.user_id
					limit 1
				)`,
			),
		)
	return true
}

export async function can_see_media(db: Db, me: string, url: string) {
	const [row] = await db
		.select({ id: message.id })
		.from(message)
		.innerJoin(
			conversationMember,
			and(
				eq(conversationMember.conversationId, message.conversationId),
				eq(conversationMember.userId, me),
			),
		)
		.where(eq(message.mediaUrl, url))
		.limit(1)
	if (row) return true
	// A group's photo is for the people in the group.
	const [group] = await db
		.select({ id: conversation.id })
		.from(conversation)
		.innerJoin(
			conversationMember,
			and(
				eq(conversationMember.conversationId, conversation.id),
				eq(conversationMember.userId, me),
			),
		)
		.where(eq(conversation.image, url))
		.limit(1)
	return !!group
}

export async function media_in_use(db: Db, url: string) {
	const [[row], [group]] = await Promise.all([
		db.select({ id: message.id }).from(message).where(eq(message.mediaUrl, url)).limit(1),
		db
			.select({ id: conversation.id })
			.from(conversation)
			.where(eq(conversation.image, url))
			.limit(1),
	])
	return !!row || !!group
}
