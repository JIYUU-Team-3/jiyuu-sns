import { json } from '@sveltejs/kit'
import { api_member } from '#lib/server/api-tokens'
import type { RequestHandler } from './$types'

/** Who a key posts as, so an agent can check its key before it posts. */
export const GET: RequestHandler = async (event) => {
	const { handle, name } = await api_member(event)
	return json({ handle, name })
}
