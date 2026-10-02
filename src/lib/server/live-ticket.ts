import { from_base64url, to_base64url } from './web-push'

export const TICKET_SECONDS = 60
const TICKET_MAX = 512

const encoder = new TextEncoder()
const decoder = new TextDecoder()

const key = (secret: string) =>
	crypto.subtle.importKey(
		'raw',
		encoder.encode(`jiyuu-live:${secret}`),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign', 'verify'],
	)

export async function sign_ticket(
	secret: string,
	user_id: string,
	conversation_id: string,
	now = Date.now(),
) {
	const payload = to_base64url(
		encoder.encode(
			JSON.stringify({ u: user_id, c: conversation_id, e: now + TICKET_SECONDS * 1000 }),
		),
	)
	const signature = await crypto.subtle.sign('HMAC', await key(secret), encoder.encode(payload))
	return `${payload}.${to_base64url(new Uint8Array(signature))}`
}

export async function read_ticket(
	secret: string,
	ticket: string,
	conversation_id: string,
	now = Date.now(),
) {
	if (!secret || ticket.length > TICKET_MAX) return undefined
	const [payload, signature, extra] = ticket.split('.')
	if (!payload || !signature || extra !== undefined) return undefined
	try {
		const valid = await crypto.subtle.verify(
			'HMAC',
			await key(secret),
			from_base64url(signature),
			encoder.encode(payload),
		)
		if (!valid) return undefined
		const data: unknown = JSON.parse(decoder.decode(from_base64url(payload)))
		if (typeof data !== 'object' || !data) return undefined
		const { u, c, e } = data as Record<string, unknown>
		if (typeof u !== 'string' || c !== conversation_id || typeof e !== 'number' || e <= now)
			return undefined
		return u
	} catch {
		return undefined
	}
}
