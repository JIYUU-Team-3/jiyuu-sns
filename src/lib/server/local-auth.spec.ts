import { describe, expect, it } from 'vitest'
import { allow_local_auth } from './local-auth'

describe('local authentication bypass', () => {
	it('allows explicitly enabled loopback HTTP development', () => {
		for (const host of ['127.0.0.1', 'localhost', '[::1]']) {
			expect(allow_local_auth(true, true, new URL(`http://${host}:5173/messages`))).toBe(true)
		}
	})

	it('never enables itself or works on a production build', () => {
		const url = new URL('http://127.0.0.1:5173/')
		expect(allow_local_auth(true, false, url)).toBe(false)
		expect(allow_local_auth(false, true, url)).toBe(false)
	})

	it('refuses deployed origins and lookalike loopback hosts', () => {
		for (const origin of [
			'https://jiyuu-sns.jiyuu-org.workers.dev',
			'http://localhost.example.com:5173',
			'http://127.0.0.1.example.com:5173',
			'http://192.168.1.10:5173',
			'https://localhost:5173',
		]) {
			expect(allow_local_auth(true, true, new URL(origin))).toBe(false)
		}
	})
})
