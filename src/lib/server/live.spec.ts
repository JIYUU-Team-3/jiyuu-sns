import { describe, expect, it } from 'vitest'
import { INBOX, open_live } from './live'
import { sign_ticket } from './live-ticket'

const SECRET = 'test-secret'
const CHAT = '6f1c2a4e-1b2c-4d5e-8f90-123456789abc'

function namespace() {
	const rooms: string[] = []
	const chat = {
		idFromName: (name: string) => name,
		get: (name: string) => ({
			fetch: async () => {
				rooms.push(name)
				return new Response(null, { status: 204 })
			},
		}),
	}
	return { rooms, env: { CHAT: chat as never, BETTER_AUTH_SECRET: SECRET } }
}

const socket = (target: string, ticket: string) =>
	new Request(`https://jiyuu.test/live/${target}?ticket=${encodeURIComponent(ticket)}`, {
		headers: { upgrade: 'websocket', origin: 'https://jiyuu.test' },
	})

describe('live inbox', () => {
	it("opens only the ticket owner's inbox", async () => {
		const { rooms, env } = namespace()
		const ticket = await sign_ticket(SECRET, 'user-1', INBOX)
		expect((await open_live(socket(INBOX, ticket), env)).status).toBe(204)
		expect(rooms).toEqual(['inbox:user-1'])
	})

	it("can't be opened with a chat's ticket, nor a chat with an inbox ticket", async () => {
		const { rooms, env } = namespace()
		const chat_ticket = await sign_ticket(SECRET, 'user-1', CHAT)
		const inbox_ticket = await sign_ticket(SECRET, 'user-1', INBOX)
		expect((await open_live(socket(INBOX, chat_ticket), env)).status).toBe(401)
		expect((await open_live(socket(CHAT, inbox_ticket), env)).status).toBe(401)
		expect(rooms).toEqual([])
	})

	it('refuses any other room name', async () => {
		const { env } = namespace()
		const ticket = await sign_ticket(SECRET, 'user-1', 'inbox:user-2')
		expect((await open_live(socket('inbox:user-2', ticket), env)).status).toBe(404)
	})
})
