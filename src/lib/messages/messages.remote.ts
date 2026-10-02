import { error } from '@sveltejs/kit'
import { env, waitUntil } from 'cloudflare:workers'
import { BETTER_AUTH_SECRET } from '$app/env/private'
import * as v from 'valibot'
import { command, query } from '$app/server'
import { is_gif_url } from '#lib/server/gifs'
import { is_own_message_upload } from '#lib/server/media'
import type { Nudge } from '#lib/server/chat-room'
import { mark_delivered_live, nudge } from '#lib/server/live'
import { sign_ticket } from '#lib/server/live-ticket'
import * as messages from '#lib/server/messages'
import { push_direct_message } from '#lib/server/push'
import { limit } from '#lib/server/rate-limit'
import { member, signed_in } from '#lib/server/session'
import { visible_text } from '#lib/profiles/form/profile'
import { conversations_arg, messages_arg } from './args'
import { GROUP_NAME_MAX, MEMBER_MAX, message_problem, REACTIONS } from './rules'
import { clean_text } from '#lib/posts/clean'
import { follows, is_limited, trust_level } from '#lib/server/moderation/trust'
import { check_message } from '#lib/server/moderation/write'

const Id = v.pipe(v.string(), v.uuid())
const UserId = v.pipe(v.string(), v.minLength(1), v.maxLength(64))
const Cursor = v.optional(v.pipe(v.string(), v.maxLength(80)))
const Size = v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(20_000))

/** Reading and marking as read need a session; `messages.ts` checks membership every time. */
const me = signed_in

/** Sending and reacting: a finished profile, at a chat's pace. */
const chatter = () => member('MESSAGE_LIMIT')

export const get_conversations = query(v.object({ cursor: Cursor }), async ({ cursor }) => {
	const { db, user_id } = me()
	if (!cursor) await delivered(db, user_id)
	return messages.conversations_page(db, user_id, cursor)
})

export const get_conversation = query(Id, async (id) => {
	const { db, user_id } = me()
	const found = await messages.find_conversation(db, user_id, id)
	if (!found) error(404, 'Conversation not found.')
	return found
})

export const get_messages = query(v.object({ id: Id, cursor: Cursor }), async ({ id, cursor }) => {
	const { db, user_id } = me()
	const page = await messages.messages_page(db, user_id, id, cursor)
	if (!page) error(404, 'Conversation not found.')
	return page
})

export const get_unread_messages = query(async () => {
	const { db, user_id } = me()
	await delivered(db, user_id)
	return messages.unread_count(db, user_id)
})

const NewMessage = v.pipe(
	v.object({
		id: Id,
		body: v.pipe(
			v.string(),
			v.maxLength(16000),
			v.transform(clean_text),
			v.trim(),
			v.maxLength(8000),
		),
		media: v.optional(
			v.object({
				kind: v.picklist(['image', 'gif']),
				url: v.pipe(v.string(), v.maxLength(2048)),
				width: Size,
				height: Size,
			}),
		),
		reply_to: v.optional(Id),
	}),
	v.check((input) => message_problem(input.body, !!input.media) === undefined, 'message_invalid'),
)

export const send_message = command(NewMessage, async ({ id, ...input }) => {
	const { db, user_id } = await chatter()
	if (input.media) {
		const ok =
			input.media.kind === 'gif'
				? is_gif_url(input.media.url)
				: is_own_message_upload(input.media.url, user_id)
		if (!ok) error(400, 'Invalid media.')
	}
	// Only the links' host names are checked; nobody reads the message itself.
	await check_message(db, user_id, await trust_level(db, user_id), input.body)
	const sent = await messages.send_message(db, user_id, id, input)
	if (sent === 'not_found') error(404, 'Conversation not found.')
	if (sent === 'blocked') error(403, 'blocked')
	waitUntil(live(id, { kind: 'refresh' }))
	waitUntil(
		push_direct_message(db, {
			conversation_id: id,
			sender_id: user_id,
			body: input.body,
			photo: !!input.media,
		}).catch((error) => console.error('Push failed', error)),
	)
	await Promise.all([
		get_messages(messages_arg(id)).refresh(),
		get_conversations(conversations_arg()).refresh(),
	])
	return sent
})

export const mark_conversation_read = command(Id, async (id) => {
	const { db, user_id } = me()
	await messages.mark_read(db, user_id, id)
	waitUntil(live(id, { kind: 'refresh' }))
	await Promise.all([
		get_unread_messages().refresh(),
		get_conversations(conversations_arg()).refresh(),
	])
})

export const react_to_message = command(
	v.object({ id: Id, emoji: v.picklist(REACTIONS) }),
	async ({ id, emoji }) => {
		const { db, user_id } = await chatter()
		const result = await messages.react(db, user_id, id, emoji)
		if (!result) error(404, 'Message not found.')
		waitUntil(live(result.conversation_id, { kind: 'refresh' }))
		await get_messages(messages_arg(result.conversation_id)).refresh()
		return result.reactions
	},
)

export const start_conversation = command(
	v.object({
		user_ids: v.pipe(v.array(UserId), v.minLength(1), v.maxLength(MEMBER_MAX - 1)),
		// Cleaned like a display name, so a group can't be named to redraw the row it sits in.
		name: v.optional(
			v.pipe(v.string(), v.transform(visible_text), v.trim(), v.maxLength(GROUP_NAME_MAX)),
		),
	}),
	async ({ user_ids, name }) => {
		// Starting a chat puts it in other people's lists, so it goes at the pace of a post.
		const { db, user_id } = await member()
		// A new account can only start a chat with people who follow it, so it can't cold-message.
		if (is_limited(await trust_level(db, user_id))) {
			for (const other of user_ids) {
				if (other !== user_id && !(await follows(db, other, user_id)))
					error(403, 'chat_new_account')
			}
		}
		const id = await messages.start_conversation(db, user_id, user_ids, name)
		if (id === 'invalid') error(400, 'Invalid members.')
		await get_conversations(conversations_arg()).refresh()
		return id
	},
)

export const leave_conversation = command(Id, async (id) => {
	const { db, user_id } = await member()
	const left = await messages.leave_conversation(db, user_id, id)
	if (!left) error(404, 'Conversation not found.')
	waitUntil(live(id, { kind: 'kick', user_id }))
	await Promise.all([
		get_conversations(conversations_arg()).refresh(),
		get_unread_messages().refresh(),
	])
})

export const live_ticket = command(Id, async (id) => {
	const { db, user_id } = me()
	await limit('LOOKUP_LIMIT', user_id)
	if (!(await messages.is_member(db, user_id, id))) error(404, 'Conversation not found.')
	return sign_ticket(BETTER_AUTH_SECRET, user_id, id)
})

const live = (id: string, message: Nudge) =>
	nudge(chat(), id, message).catch((error) => console.error('Live update failed', error))

const delivered = (db: Parameters<typeof messages.mark_delivered>[0], user_id: string) =>
	mark_delivered_live(chat(), () => messages.mark_delivered(db, user_id))

const chat = () => (import.meta.env.DEV ? undefined : env.CHAT)
