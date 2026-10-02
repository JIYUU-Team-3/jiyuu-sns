import type { Nudge } from './chat-room'
import { read_ticket } from './live-ticket'

const CONVERSATION = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const LIVE_PREFIX = '/live/'
const NUDGE_MAX = 20

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
	const conversation_id = url.pathname.slice(LIVE_PREFIX.length)
	if (!CONVERSATION.test(conversation_id)) return new Response('Not found.', { status: 404 })
	const user_id = await read_ticket(
		env.BETTER_AUTH_SECRET,
		url.searchParams.get('ticket') ?? '',
		conversation_id,
	)
	if (!user_id) return new Response('Sign in to continue.', { status: 401 })

	const headers = new Headers(request.headers)
	headers.set('x-live-user', user_id)
	return env.CHAT.get(env.CHAT.idFromName(conversation_id)).fetch(
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
	conversation_id: string,
	message: Nudge,
) {
	if (!chat) return
	await chat.get(chat.idFromName(conversation_id)).fetch('https://room/nudge', {
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
