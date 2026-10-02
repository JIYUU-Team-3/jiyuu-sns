import { live_ticket } from './messages.remote'

export type LiveEvent = { type: 'refresh' } | { type: 'typing'; user_id: string; on: boolean }

const RETRY_MAX = 30_000

export function connect_live(id: string, onevent: (event: LiveEvent) => void) {
	let socket: WebSocket | undefined
	let closed = false
	let attempt = 0
	let timer: ReturnType<typeof setTimeout> | undefined

	const retry = () => {
		socket = undefined
		if (closed) return
		timer = setTimeout(() => void open(), Math.min(RETRY_MAX, 1_000 * 2 ** attempt++))
	}

	async function open() {
		try {
			const ticket = await live_ticket(id)
			if (closed) return
			const url = new URL(`/live/${id}`, location.href)
			url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
			url.searchParams.set('ticket', ticket)
			const next = new WebSocket(url)
			socket = next
			next.onopen = () => (attempt = 0)
			next.onclose = (event) => {
				if (socket === next) socket = undefined
				onevent({ type: 'refresh' })
				if (event.code !== 4001) retry()
			}
			next.onmessage = (event) => {
				try {
					onevent(JSON.parse(event.data) as LiveEvent)
				} catch {
					return
				}
			}
		} catch {
			retry()
		}
	}

	void open()

	return {
		get open() {
			return socket?.readyState === WebSocket.OPEN
		},
		send(text: 'typing' | 'idle') {
			if (socket?.readyState === WebSocket.OPEN) socket.send(text)
		},
		close() {
			closed = true
			clearTimeout(timer)
			socket?.close(1000)
		},
	}
}
