import { DurableObject } from 'cloudflare:workers'

export const ROOM_SOCKETS_MAX = 100
const FRAME_MAX = 16
const TYPING_GAP = 1_000

const quietly = (run: () => void) => {
	try {
		run()
	} catch {
		return
	}
}

export type Nudge =
	| { kind: 'refresh' }
	| { kind: 'group' }
	| { kind: 'notification' }
	| { kind: 'kick'; user_id: string }

export class ChatRoom extends DurableObject {
	private typing = new Map<string, number>()

	async fetch(request: Request) {
		const url = new URL(request.url)
		if (url.pathname === '/nudge') return this.nudge(request)

		const user_id = request.headers.get('x-live-user')
		if (!user_id || request.headers.get('upgrade')?.toLowerCase() !== 'websocket')
			return new Response('Expected a WebSocket.', { status: 426 })
		if (this.ctx.getWebSockets().length >= ROOM_SOCKETS_MAX)
			return new Response('Too many connections.', { status: 429 })

		const { 0: client, 1: server } = new WebSocketPair()
		this.ctx.acceptWebSocket(server, [user_id])
		return new Response(null, { status: 101, webSocket: client })
	}

	webSocketMessage(socket: WebSocket, data: string | ArrayBuffer) {
		if (typeof data !== 'string' || data.length > FRAME_MAX) return
		const [user_id] = this.ctx.getTags(socket)
		if (!user_id) return
		const now = Date.now()
		if (data === 'typing') {
			if (now - (this.typing.get(user_id) ?? 0) < TYPING_GAP) return
			this.typing.set(user_id, now)
			this.send_others(user_id, { type: 'typing', user_id, on: true })
		} else if (data === 'idle' && this.typing.delete(user_id)) {
			this.send_others(user_id, { type: 'typing', user_id, on: false })
		}
	}

	webSocketClose(socket: WebSocket, code: number) {
		this.gone(socket, code)
	}

	webSocketError(socket: WebSocket) {
		this.gone(socket, 1011)
	}

	private gone(socket: WebSocket, code: number) {
		const [user_id] = this.ctx.getTags(socket)
		quietly(() => socket.close(code === 1005 ? 1000 : code))
		if (!user_id || this.ctx.getWebSockets(user_id).some((other) => other !== socket)) return
		if (this.typing.delete(user_id))
			this.send_others(user_id, { type: 'typing', user_id, on: false })
	}

	private async nudge(request: Request) {
		const body = (await request.json().catch(() => undefined)) as Nudge | undefined
		if (body?.kind === 'refresh') this.send_others(undefined, { type: 'refresh' })
		// The group's name, photo, members or roles changed.
		if (body?.kind === 'group') this.send_others(undefined, { type: 'group' })
		// An inbox room only: its owner's unread notifications changed.
		if (body?.kind === 'notification') this.send_others(undefined, { type: 'notification' })
		if (body?.kind === 'kick' && typeof body.user_id === 'string') {
			for (const socket of this.ctx.getWebSockets(body.user_id)) socket.close(4001, 'Left')
		}
		return new Response(null, { status: 204 })
	}

	private send_others(user_id: string | undefined, message: object) {
		const text = JSON.stringify(message)
		for (const socket of this.ctx.getWebSockets()) {
			if (user_id && this.ctx.getTags(socket).includes(user_id)) continue
			quietly(() => socket.send(text))
		}
	}
}
