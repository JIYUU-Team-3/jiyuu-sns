import { describe, expect, it } from 'vitest'
import { blockedMediaHash } from '../db/schema'
import { test_db } from '../db/test-d1'
import { is_blocked_media, sha256 } from './media'

describe('blocked media', () => {
	it('matches the exact bytes and nothing else', async () => {
		const db = test_db()
		const bytes = new TextEncoder().encode('a removed image')
		expect(await sha256(new TextEncoder().encode('abc'))).toBe(
			'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
		)
		expect(await is_blocked_media(db, bytes)).toBe(false)
		await db.insert(blockedMediaHash).values({ sha256: await sha256(bytes) })
		expect(await is_blocked_media(db, bytes)).toBe(true)
		expect(await is_blocked_media(db, new TextEncoder().encode('another image'))).toBe(false)
	})
})
