import { error, type RequestEvent } from '@sveltejs/kit'
import { and, desc, eq, sql } from 'drizzle-orm'
import type { getDb } from './db'
import { apiToken } from './db/schema'
import { find_standing } from './moderation/standing'
import { find_profile } from './profiles'
import { limit } from './rate-limit'

type Db = ReturnType<typeof getDb>

/**
 * Keys members make for their own agents, which may post as them through `/api/v1` and do
 * nothing else. A key is 32 random bytes; only its SHA-256 is stored, so a copy of the database
 * holds no working key. See docs/API.md.
 */

export const TOKEN_PREFIX = 'jiyuu_'
/** Most keys one account can hold at once. */
export const TOKENS_MAX = 5
export const TOKEN_NAME_MAX = 40

/** `jiyuu_` and 43 base64url characters: 32 bytes with no padding. */
const TOKEN_PATTERN = /^jiyuu_[A-Za-z0-9_-]{43}$/

export function new_token() {
	const bytes = crypto.getRandomValues(new Uint8Array(32))
	const base64 = btoa(String.fromCharCode(...bytes))
	return TOKEN_PREFIX + base64.replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

export async function hash_token(token: string) {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** The key in an `Authorization: Bearer …` header, if it looks like one of ours. */
export function bearer_token(header: string | null) {
	const match = header?.match(/^Bearer +(\S+)$/i)
	return match && TOKEN_PATTERN.test(match[1]) ? match[1] : undefined
}

/** The account's keys, newest first, without anything that would let them be used. */
export function list_tokens(db: Db, user_id: string) {
	return db
		.select({
			id: apiToken.id,
			name: apiToken.name,
			hint: apiToken.hint,
			created_at: apiToken.createdAt,
			last_used_at: apiToken.lastUsedAt,
		})
		.from(apiToken)
		.where(eq(apiToken.userId, user_id))
		.orderBy(desc(apiToken.createdAt))
}

/**
 * Make a key and return it; this is the only time it exists outside the caller. Undefined once
 * the account holds `TOKENS_MAX`, counted in the statement that inserts.
 */
export async function create_token(db: Db, user_id: string, name: string) {
	const token = new_token()
	const hash = await hash_token(token)
	const made = await db.all<{ id: string }>(
		sql`insert into api_token (id, user_id, name, hash, hint)
			select ${crypto.randomUUID()}, ${user_id}, ${name}, ${hash}, ${token.slice(-4)}
			where (select count(*) from api_token where user_id = ${user_id}) < ${TOKENS_MAX}
			returning id`,
	)
	return made[0] && { id: made[0].id, token }
}

/** Whether a key of this account's was there to remove. */
export async function revoke_token(db: Db, user_id: string, id: string) {
	const removed = await db
		.delete(apiToken)
		.where(and(eq(apiToken.id, id), eq(apiToken.userId, user_id)))
		.returning({ id: apiToken.id })
	return removed.length > 0
}

/** The account a key belongs to, noting that it was used. */
export async function token_owner(db: Db, token: string) {
	const [row] = await db
		.update(apiToken)
		.set({ lastUsedAt: new Date() })
		.where(eq(apiToken.hash, await hash_token(token)))
		.returning({ user_id: apiToken.userId })
	return row?.user_id
}

/**
 * Every `/api/v1` handler starts here, in place of `member()`: no session cookie is read, only
 * the bearer key. Each address is held to `API_LIMIT` before the key is looked up, and the
 * account behind it must have a profile and not be suspended, as a signed-in member must.
 */
export async function api_member({ request, getClientAddress, locals }: RequestEvent) {
	await limit('API_LIMIT', getClientAddress())
	const token = bearer_token(request.headers.get('authorization'))
	const user_id = token && (await token_owner(locals.db, token))
	if (!user_id) error(401, 'invalid_token')
	if ((await find_standing(locals.db, user_id)).suspension) error(403, 'suspended')
	const profile = await find_profile(locals.db, user_id)
	if (!profile) error(403, 'no_profile')
	return { db: locals.db, user_id, handle: profile.handle, name: profile.displayName }
}
