import { error } from '@sveltejs/kit'
import * as v from 'valibot'
import { command, query } from '$app/server'
import * as tokens from '#lib/server/api-tokens'
import { trust_level } from '#lib/server/moderation/trust'
import { member, signed_in } from '#lib/server/session'

const Name = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(tokens.TOKEN_NAME_MAX))

/** The account's own keys; there is no way to ask about anyone else's. */
export const get_api_tokens = query(() => {
	const { db, user_id } = signed_in()
	return tokens.list_tokens(db, user_id)
})

/**
 * Make a key and hand it back this once. A key posts without a person at the keyboard, so an
 * account still in its first hours, or one a moderator restricted, can't make one.
 */
export const create_api_token = command(Name, async (name) => {
	const { db, user_id } = await member()
	const trust = await trust_level(db, user_id)
	if (trust === 'new') error(403, 'token_new_account')
	if (trust === 'restricted') error(403, 'token_restricted')
	const made = await tokens.create_token(db, user_id, name)
	if (!made) error(409, 'tokens_full')
	await get_api_tokens().refresh()
	return made
})

export const revoke_api_token = command(v.pipe(v.string(), v.uuid()), async (id) => {
	const { db, user_id } = await member()
	if (!(await tokens.revoke_token(db, user_id, id))) error(404, 'Key not found.')
	await get_api_tokens().refresh()
})
