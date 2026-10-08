import { beforeEach, describe, expect, it } from 'vitest'
import {
	bearer_token,
	create_token,
	hash_token,
	list_tokens,
	new_token,
	revoke_token,
	token_owner,
	TOKENS_MAX,
} from './api-tokens'
import { apiToken } from './db/schema'
import { add_account, test_db, type TestDb } from './db/test-d1'

describe('API keys', () => {
	let db: TestDb

	beforeEach(async () => {
		db = test_db()
		for (const handle of ['alice', 'bob']) await add_account(db, handle)
	})

	it('makes keys the header parser takes, and nothing else', () => {
		const token = new_token()
		expect(token).toMatch(/^jiyuu_[A-Za-z0-9_-]{43}$/)
		expect(new_token()).not.toBe(token)
		expect(bearer_token(`Bearer ${token}`)).toBe(token)
		expect(bearer_token(`bearer ${token}`)).toBe(token)
		expect(bearer_token(token)).toBeUndefined()
		expect(bearer_token(`Basic ${token}`)).toBeUndefined()
		expect(bearer_token(`Bearer ${token}x`)).toBeUndefined()
		expect(bearer_token('Bearer jiyuu_short')).toBeUndefined()
		expect(bearer_token(null)).toBeUndefined()
	})

	it('stores only the hash, and finds the owner by the key', async () => {
		const made = await create_token(db, 'alice', 'agent')
		expect(made).toBeDefined()
		const [row] = await db.select().from(apiToken)
		expect(row.hash).toBe(await hash_token(made!.token))
		expect(JSON.stringify(row)).not.toContain(made!.token)
		expect(row.hint).toBe(made!.token.slice(-4))

		expect(await token_owner(db, made!.token)).toBe('alice')
		expect(await token_owner(db, new_token())).toBeUndefined()
		const [listed] = await list_tokens(db, 'alice')
		expect(listed.last_used_at).toBeInstanceOf(Date)
		expect(Object.keys(listed)).not.toContain('hash')
	})

	it(`stops at ${TOKENS_MAX} keys an account`, async () => {
		for (let i = 0; i < TOKENS_MAX; i++)
			expect(await create_token(db, 'alice', `k${i}`)).toBeDefined()
		expect(await create_token(db, 'alice', 'one more')).toBeUndefined()
		expect(await create_token(db, 'bob', 'his own')).toBeDefined()
	})

	it('lets only the owner revoke a key, and a revoked key stops working', async () => {
		const made = (await create_token(db, 'alice', 'agent'))!
		expect(await revoke_token(db, 'bob', made.id)).toBe(false)
		expect(await token_owner(db, made.token)).toBe('alice')
		expect(await revoke_token(db, 'alice', made.id)).toBe(true)
		expect(await token_owner(db, made.token)).toBeUndefined()
	})
})
