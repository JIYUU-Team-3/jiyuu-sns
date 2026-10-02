import { describe, expect, it } from 'vitest'
import { read_ticket, sign_ticket, TICKET_SECONDS } from './live-ticket'

const SECRET = 'test-secret'
const CHAT = '6f1c2a4e-1b2c-4d5e-8f90-123456789abc'
const OTHER = '0a1b2c3d-1b2c-4d5e-8f90-123456789abc'
const NOW = 1_800_000_000_000

describe('live tickets', () => {
	it('name the person they were made for', async () => {
		const ticket = await sign_ticket(SECRET, 'user-1', CHAT, NOW)
		expect(await read_ticket(SECRET, ticket, CHAT, NOW + 1_000)).toBe('user-1')
	})

	it('only open the chat they were made for', async () => {
		const ticket = await sign_ticket(SECRET, 'user-1', CHAT, NOW)
		expect(await read_ticket(SECRET, ticket, OTHER, NOW)).toBeUndefined()
	})

	it('expire', async () => {
		const ticket = await sign_ticket(SECRET, 'user-1', CHAT, NOW)
		expect(await read_ticket(SECRET, ticket, CHAT, NOW + TICKET_SECONDS * 1000)).toBeUndefined()
	})

	it('refuse another secret, an edited payload and junk', async () => {
		const ticket = await sign_ticket(SECRET, 'user-1', CHAT, NOW)
		expect(await read_ticket('other-secret', ticket, CHAT, NOW)).toBeUndefined()
		const forged = await sign_ticket('other-secret', 'user-2', CHAT, NOW)
		const swapped = `${forged.split('.')[0]}.${ticket.split('.')[1]}`
		expect(await read_ticket(SECRET, swapped, CHAT, NOW)).toBeUndefined()
		for (const junk of ['', '.', 'a.b', 'a.b.c', 'x'.repeat(600)])
			expect(await read_ticket(SECRET, junk, CHAT, NOW)).toBeUndefined()
		expect(await read_ticket('', ticket, CHAT, NOW)).toBeUndefined()
	})
})
