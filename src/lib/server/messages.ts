import { and, asc, desc, eq, inArray, isNotNull, ne, or, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import type {
	ConversationPage,
	ConversationView,
	LastMessage,
	MessageMedia,
	MessagePage,
	MessageView,
	Reaction,
	Receipt,
} from '#lib/messages/types'
import { direct_key, MEMBER_MAX } from '#lib/messages/rules'
import { shown_image } from './account-image'
import type { getDb } from './db'
import { blocked_between, is_blocked } from './safety'
import {
	conversation,
	conversationMember,
	message,
	messageReaction,
	profile,
	user,
} from './db/schema'

type Db = ReturnType<typeof getDb>

export const CONVERSATION_PAGE = 20
export const MESSAGE_PAGE = 30

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

type ConversationRow = {
	id: string
	name: string | null
	is_group: boolean
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
			is_group: conversation.isGroup,
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
			group: row.is_group,
			members: (by_conversation.get(row.id) ?? []).map((member) => ({
				id: member.id,
				name: member.name,
				handle: member.handle ?? undefined,
				image: member.image ?? undefined,
				joined: member.joined,
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
				or(isNotNull(conversation.lastMessageAt), eq(conversation.createdBy, me)),
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

	const rows = await db
		.select({
			id: message.id,
			sender_id: message.senderId,
			sender_name: display_name,
			sender_handle: profile.handle,
			sender_image: avatar,
			body: message.body,
			media_kind: message.mediaKind,
			media_url: message.mediaUrl,
			media_width: message.mediaWidth,
			media_height: message.mediaHeight,
			media_name: message.mediaName,
			media_size: message.mediaSize,
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
		body: row.body,
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
	media_kind: 'image' | 'gif' | 'file' | null
	media_url: string | null
	media_width: number | null
	media_height: number | null
	media_name: string | null
	media_size: number | null
}): MessageMedia | undefined {
	if (!row.media_kind || !row.media_url) return undefined
	if (row.media_kind === 'file')
		return {
			kind: 'file',
			url: row.media_url,
			name: row.media_name ?? 'file',
			size: row.media_size ?? 0,
		}
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
			.where(and(eq(message.id, input.reply_to), eq(message.conversationId, conversation_id)))
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
			mediaWidth: input.media && input.media.kind !== 'file' ? input.media.width : null,
			mediaHeight: input.media && input.media.kind !== 'file' ? input.media.height : null,
			mediaName: input.media?.kind === 'file' ? input.media.name : null,
			mediaSize: input.media?.kind === 'file' ? input.media.size : null,
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
		.where(eq(message.id, message_id))
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
		db
			.insert(conversationMember)
			.values([me, ...others].map((userId) => ({ conversationId: id, userId }))),
	])
	return id
}

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
	if (!left) await db.delete(conversation).where(eq(conversation.id, conversation_id))
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
	return !!row
}

export async function media_in_use(db: Db, url: string) {
	const [row] = await db
		.select({ id: message.id })
		.from(message)
		.where(eq(message.mediaUrl, url))
		.limit(1)
	return !!row
}
