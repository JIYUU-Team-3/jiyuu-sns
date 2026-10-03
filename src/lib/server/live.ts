import type { Nudge } from './chat-room'
import { read_ticket } from './live-ticket'

const CONVERSATION = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const LIVE_PREFIX = '/live/'
export const INBOX = 'inbox'
const NUDGE_MAX = 20
const INBOX_NUDGE_MAX = 50

export const inbox_room = (user_id: string) => `${INBOX}:${user_id}`

export async function open_live(
	request: Request,
	env: Partial<Pick<Env, 'CHAT' | 'BETTER_AUTH_SECRET'>>,
) {
	if (!env.CHAT || !env.BETTER_AUTH_SECRET) return new Response('Not found.', { status: 404 })
	if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket')
		return new Response('Expected a WebSocket.', { status: 426 })
	const url = new URL(request.url)
	if (!same_site(request.headers.get('origin'), url))
		return new Response('Forbidden.', { status: 403 })
	const target = url.pathname.slice(LIVE_PREFIX.length)
	if (target !== INBOX && !CONVERSATION.test(target))
		return new Response('Not found.', { status: 404 })
	const user_id = await read_ticket(
		env.BETTER_AUTH_SECRET,
		url.searchParams.get('ticket') ?? '',
		target,
	)
	if (!user_id) return new Response('Sign in to continue.', { status: 401 })

	const room = target === INBOX ? inbox_room(user_id) : target
	const headers = new Headers(request.headers)
	headers.set('x-live-user', user_id)
	return env.CHAT.get(env.CHAT.idFromName(room)).fetch(
		new Request('https://room/connect', { headers }),
	)
}

function same_site(origin: string | null, url: URL) {
	if (!origin) return false
	try {
		return new URL(origin).host === url.host
	} catch {
		return false
	}
}

export async function nudge(
	chat: DurableObjectNamespace | undefined,
	room: string,
	message: Nudge,
) {
	if (!chat) return
	await chat.get(chat.idFromName(room)).fetch('https://room/nudge', {
		method: 'POST',
		body: JSON.stringify(message),
	})
}

export async function mark_delivered_live(
	chat: DurableObjectNamespace | undefined,
	mark: () => Promise<string[]>,
) {
	const changed = await mark()
	return Promise.all(
		changed
			.slice(0, NUDGE_MAX)
			.map((id) =>
				nudge(chat, id, { kind: 'refresh' }).catch((error) =>
					console.error('Live update failed', error),
				),
			),
	)
}

export async function nudge_inboxes(chat: DurableObjectNamespace | undefined, user_ids: string[]) {
	await Promise.all(
		user_ids
			.slice(0, INBOX_NUDGE_MAX)
			.map((user_id) =>
				nudge(chat, inbox_room(user_id), { kind: 'refresh' }).catch((error) =>
					console.error('Inbox update failed', error),
				),
			),
	)
}
