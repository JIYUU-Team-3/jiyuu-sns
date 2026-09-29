import { describe, expect, it } from 'vitest'
import {
	derive_keys,
	encrypt_payload,
	from_base64url,
	generate_vapid_keys,
	is_push_endpoint,
	to_base64url,
	vapid_authorization,
} from './web-push'

/** A browser's side of a subscription: its key pair and auth secret. */
async function browser_keys() {
	const pair = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
		'deriveBits',
	])) as CryptoKeyPair
	const raw = new Uint8Array((await crypto.subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer)
	const auth = crypto.getRandomValues(new Uint8Array(16))
	return { pair, p256dh: to_base64url(raw), auth: to_base64url(auth) }
}

/** Decrypt an aes128gcm body the way a browser does. */
async function decrypt(body: Uint8Array, keys: Awaited<ReturnType<typeof browser_keys>>) {
	const salt = body.slice(0, 16)
	const record_size = new DataView(body.buffer, body.byteOffset).getUint32(16)
	const id_length = body[20]
	const as_public = body.slice(21, 21 + id_length)
	const ciphertext = body.slice(21 + id_length)

	const as_key = await crypto.subtle.importKey(
		'raw',
		as_public,
		{ name: 'ECDH', namedCurve: 'P-256' },
		false,
		[],
	)
	const ecdh_secret = new Uint8Array(
		await crypto.subtle.deriveBits({ name: 'ECDH', public: as_key }, keys.pair.privateKey, 256),
	)
	const { cek, nonce } = await derive_keys(
		ecdh_secret,
		from_base64url(keys.auth),
		from_base64url(keys.p256dh),
		as_public,
		salt,
	)
	const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt'])
	const plain = new Uint8Array(
		await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, ciphertext),
	)
	return {
		record_size,
		id_length,
		delimiter: plain.at(-1),
		text: new TextDecoder().decode(plain.slice(0, -1)),
	}
}

describe('base64url', () => {
	it('round-trips bytes without padding', () => {
		const bytes = Uint8Array.from([0, 250, 251, 252, 253, 254, 255])
		const text = to_base64url(bytes)
		expect(text).not.toMatch(/[+/=]/)
		expect(from_base64url(text)).toEqual(bytes)
	})
})

describe('derive_keys', () => {
	it('decrypts the example message from RFC 8291 section 5', async () => {
		const ua_public = from_base64url(
			'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
		)
		const private_key = await crypto.subtle.importKey(
			'jwk',
			{
				kty: 'EC',
				crv: 'P-256',
				x: to_base64url(ua_public.slice(1, 33)),
				y: to_base64url(ua_public.slice(33)),
				d: 'q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94',
			},
			{ name: 'ECDH', namedCurve: 'P-256' },
			false,
			['deriveBits'],
		)
		const body = from_base64url(
			'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
		)
		const result = await decrypt(body, {
			pair: { privateKey: private_key } as CryptoKeyPair,
			p256dh: to_base64url(ua_public),
			auth: 'BTBZMqHH6r4Tts7J_aSIgg',
		})
		expect(result).toEqual({
			record_size: 4096,
			id_length: 65,
			delimiter: 2,
			text: 'When I grow up, I want to be a watermelon',
		})
	})
})

describe('encrypt_payload', () => {
	it('produces an aes128gcm body the browser can decrypt', async () => {
		const keys = await browser_keys()
		const payload = JSON.stringify({ title: 'さくら liked your post', body: 'កម្ពុជា #jiyuu' })
		const body = await encrypt_payload(
			{ endpoint: 'https://fcm.googleapis.com/fcm/send/x', p256dh: keys.p256dh, auth: keys.auth },
			payload,
		)
		const result = await decrypt(body, keys)
		expect(result).toEqual({ record_size: 4096, id_length: 65, delimiter: 2, text: payload })
	})

	it('uses a fresh key and salt every time', async () => {
		const keys = await browser_keys()
		const target = {
			endpoint: 'https://fcm.googleapis.com/x',
			p256dh: keys.p256dh,
			auth: keys.auth,
		}
		const a = await encrypt_payload(target, 'same')
		const b = await encrypt_payload(target, 'same')
		expect(to_base64url(a)).not.toBe(to_base64url(b))
	})
})

describe('vapid_authorization', () => {
	it('signs a JWT for the push service origin that verifies with the public key', async () => {
		const keys = { ...(await generate_vapid_keys()), subject: 'mailto:team@example.test' }
		const now = Date.UTC(2026, 0, 1)
		const header = await vapid_authorization('https://fcm.googleapis.com/fcm/send/abc', keys, now)

		const [, token, k] = header.match(/^vapid t=([^,]+), k=(.+)$/)!
		expect(k).toBe(keys.public_key)
		const [head, claims, signature] = token.split('.')
		expect(JSON.parse(new TextDecoder().decode(from_base64url(claims)))).toEqual({
			aud: 'https://fcm.googleapis.com',
			exp: now / 1000 + 12 * 60 * 60,
			sub: 'mailto:team@example.test',
		})

		const public_key = await crypto.subtle.importKey(
			'raw',
			from_base64url(keys.public_key),
			{ name: 'ECDSA', namedCurve: 'P-256' },
			false,
			['verify'],
		)
		const valid = await crypto.subtle.verify(
			{ name: 'ECDSA', hash: 'SHA-256' },
			public_key,
			from_base64url(signature),
			new TextEncoder().encode(`${head}.${claims}`),
		)
		expect(valid).toBe(true)
	})
})

describe('is_push_endpoint', () => {
	it('accepts the browsers’ push services over https', () => {
		expect(is_push_endpoint('https://fcm.googleapis.com/fcm/send/abc')).toBe(true)
		expect(is_push_endpoint('https://updates.push.services.mozilla.com/wpush/v2/abc')).toBe(true)
		expect(is_push_endpoint('https://web.push.apple.com/abc')).toBe(true)
		expect(is_push_endpoint('https://wns2-db5p.notify.windows.com/w/?token=abc')).toBe(true)
	})

	it('refuses anything else', () => {
		expect(is_push_endpoint('http://fcm.googleapis.com/fcm/send/abc')).toBe(false)
		expect(is_push_endpoint('https://evil.example/fcm.googleapis.com')).toBe(false)
		expect(is_push_endpoint('https://fcm.googleapis.com.evil.example/')).toBe(false)
		expect(is_push_endpoint('not a url')).toBe(false)
	})
})
