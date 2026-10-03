import { describe, expect, it } from 'vitest'
import { avatar_hue } from './avatar'

/** The hue as it was first defined: 31-based, wrapped to a signed 32-bit integer at every step. */
function reference_hue(seed: string) {
	let hash = 0n
	for (const char of seed) hash = BigInt.asIntN(32, hash * 31n + BigInt(char.charCodeAt(0)))
	const value = Number(hash)
	return Math.abs(value) % 360
}

describe('avatar_hue', () => {
	it('keeps every account’s colour as it was', () => {
		const seeds = [
			'',
			'a',
			'mika@example.com',
			'local-dev-user',
			'0c6f4f6e-7a1b-4c9e-9d1a-2f3b4c5d6e7f',
			'ミカ・タナカ',
			'សួស្តី',
			'😀👋🏽 emoji seeds',
			'x'.repeat(200),
		]
		for (let i = 0; i < 500; i++) seeds.push(crypto.randomUUID())
		for (const seed of seeds) expect(avatar_hue(seed), seed).toBe(reference_hue(seed))
	})
})
