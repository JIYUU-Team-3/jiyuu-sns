/*
 * Web Push with nothing but WebCrypto, so it runs on Workers without a dependency:
 * payload encryption per RFC 8291 (aes128gcm) and VAPID authentication per RFC 8292.
 */

export type PushTarget = {
	endpoint: string
	/** The browser's P-256 public key, base64url (65 bytes uncompressed). */
	p256dh: string
	/** The browser's 16-byte auth secret, base64url. */
	auth: string
}

export type VapidKeys = {
	/** P-256 public key, base64url (65 bytes uncompressed). Also given to the browser. */
	public_key: string
	/** P-256 private scalar, base64url (32 bytes). */
	private_key: string
	/** A `mailto:` or `https:` contact for push services. */
	subject: string
}

const encoder = new TextEncoder()

/** Bytes backed by a plain ArrayBuffer, which is what WebCrypto accepts. */
type Bytes = Uint8Array<ArrayBuffer>

export function to_base64url(bytes: Uint8Array) {
	let binary = ''
	for (const byte of bytes) binary += String.fromCharCode(byte)
	const base64 = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_')
	// base64url drops the `=` padding (at most two).
	let end = base64.length
	while (base64[end - 1] === '=') end--
	return base64.slice(0, end)
}

export function from_base64url(text: string): Bytes {
	const base64 = text.replace(/-/g, '+').replace(/_/g, '/')
	const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4))
	return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function concat(...parts: Uint8Array[]): Bytes {
	const out = new Uint8Array(parts.reduce((n, part) => n + part.length, 0))
	let at = 0
	for (const part of parts) {
		out.set(part, at)
		at += part.length
	}
	return out
}

/** HKDF-SHA-256, extract and expand in one step. */
async function hkdf(salt: Bytes, ikm: Bytes, info: Bytes, length: number) {
	const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
	const bits = await crypto.subtle.deriveBits(
		{ name: 'HKDF', hash: 'SHA-256', salt, info },
		key,
		length * 8,
	)
	return new Uint8Array(bits)
}

/** The content key and nonce both sides derive from the shared ECDH secret. */
export async function derive_keys(
	ecdh_secret: Bytes,
	auth_secret: Bytes,
	ua_public: Bytes,
	as_public: Bytes,
	salt: Bytes,
) {
	const key_info = concat(encoder.encode('WebPush: info\0'), ua_public, as_public)
	const ikm = await hkdf(auth_secret, ecdh_secret, key_info, 32)
	const cek = await hkdf(salt, ikm, encoder.encode('Content-Encoding: aes128gcm\0'), 16)
	const nonce = await hkdf(salt, ikm, encoder.encode('Content-Encoding: nonce\0'), 12)
	return { cek, nonce }
}

/** Records are sized well above any notification we send, so the body is one record. */
const RECORD_SIZE = 4096

/** Encrypt `payload` for one browser; returns the full aes128gcm request body. */
export async function encrypt_payload(target: PushTarget, payload: string) {
	const ua_public = from_base64url(target.p256dh)
	const auth_secret = from_base64url(target.auth)

	const ephemeral = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
		'deriveBits',
	])) as CryptoKeyPair
	const as_public = new Uint8Array(
		(await crypto.subtle.exportKey('raw', ephemeral.publicKey)) as ArrayBuffer,
	)
	const ua_key = await crypto.subtle.importKey(
		'raw',
		ua_public,
		{ name: 'ECDH', namedCurve: 'P-256' },
		false,
		[],
	)
	const ecdh_secret = new Uint8Array(
		await crypto.subtle.deriveBits({ name: 'ECDH', public: ua_key }, ephemeral.privateKey, 256),
	)

	const salt = crypto.getRandomValues(new Uint8Array(16))
	const { cek, nonce } = await derive_keys(ecdh_secret, auth_secret, ua_public, as_public, salt)

	// The 0x02 delimiter marks the last (and only) record; no extra padding.
	const plaintext = concat(encoder.encode(payload), new Uint8Array([2]))
	if (plaintext.length + 16 > RECORD_SIZE) throw new Error('Push payload is too large.')
	const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
	const ciphertext = new Uint8Array(
		await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, plaintext),
	)

	const header = new Uint8Array(21 + as_public.length)
	header.set(salt, 0)
	new DataView(header.buffer).setUint32(16, RECORD_SIZE)
	header[20] = as_public.length
	header.set(as_public, 21)
	return concat(header, ciphertext)
}

async function import_vapid_private(keys: VapidKeys) {
	const pub = from_base64url(keys.public_key)
	return crypto.subtle.importKey(
		'jwk',
		{
			kty: 'EC',
			crv: 'P-256',
			x: to_base64url(pub.slice(1, 33)),
			y: to_base64url(pub.slice(33, 65)),
			d: keys.private_key,
		},
		{ name: 'ECDSA', namedCurve: 'P-256' },
		false,
		['sign'],
	)
}

/** The `Authorization` header value for one push service origin, valid for 12 hours. */
export async function vapid_authorization(endpoint: string, keys: VapidKeys, now = Date.now()) {
	const segment = (value: object) => to_base64url(encoder.encode(JSON.stringify(value)))
	const unsigned = `${segment({ typ: 'JWT', alg: 'ES256' })}.${segment({
		aud: new URL(endpoint).origin,
		exp: Math.floor(now / 1000) + 12 * 60 * 60,
		sub: keys.subject,
	})}`
	// WebCrypto signs ECDSA as raw r‖s, which is exactly what JWS ES256 expects.
	const signature = await crypto.subtle.sign(
		{ name: 'ECDSA', hash: 'SHA-256' },
		await import_vapid_private(keys),
		encoder.encode(unsigned),
	)
	return `vapid t=${unsigned}.${to_base64url(new Uint8Array(signature))}, k=${keys.public_key}`
}

/** The push services browsers actually use; anything else is refused before it's stored. */
const PUSH_HOSTS = ['updates.push.services.mozilla.com', 'push.apple.com', 'notify.windows.com']

/**
 * Chrome, Brave and other Chromium browsers use FCM, which hands out `fcm.googleapis.com` and
 * numbered hosts like `jmt17.google.com`. Only those exact hosts, and only FCM's own paths, so
 * a subscription can't point the server at any other Google service.
 */
const FCM_HOST = /^(?:fcm\.googleapis\.com|jmt\d+\.google\.com)$/
const FCM_PATH = /^\/(?:fcm\/send|wp)\//

export function is_push_endpoint(endpoint: string) {
	try {
		const url = new URL(endpoint)
		if (url.protocol !== 'https:' || url.port) return false
		if (FCM_HOST.test(url.hostname)) return FCM_PATH.test(url.pathname)
		return PUSH_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))
	} catch {
		return false
	}
}

export type SendResult = 'sent' | 'gone' | 'failed'

/**
 * Deliver one message. `gone` means the browser unsubscribed or the subscription expired, so the
 * caller should forget it.
 */
export async function send_push(
	target: PushTarget,
	payload: string,
	keys: VapidKeys,
	options: { ttl?: number; topic?: string } = {},
): Promise<SendResult> {
	const body = await encrypt_payload(target, payload)
	const headers = new Headers([
		['authorization', await vapid_authorization(target.endpoint, keys)],
		['content-encoding', 'aes128gcm'],
		['content-type', 'application/octet-stream'],
		['ttl', String(options.ttl ?? 24 * 60 * 60)],
		['urgency', 'normal'],
	])
	// A newer message with the same topic replaces an undelivered older one.
	if (options.topic) headers.set('topic', options.topic)
	const response = await fetch(target.endpoint, { method: 'POST', headers, body })
	if (response.status === 404 || response.status === 410) return 'gone'
	return response.ok ? 'sent' : 'failed'
}

/** A fresh VAPID key pair, for `pnpm push:keys`. */
export async function generate_vapid_keys() {
	const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
		'sign',
		'verify',
	])) as CryptoKeyPair
	const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
	const raw = new Uint8Array((await crypto.subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer)
	return { public_key: to_base64url(raw), private_key: jwk.d! }
}
