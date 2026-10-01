import { error } from '@sveltejs/kit'
import { env } from 'cloudflare:workers'

/** The rate limiters bound in wrangler.jsonc; each has its own limit per minute. */
export type Limiter = 'WRITE_LIMIT' | 'UPLOAD_LIMIT' | 'LOOKUP_LIMIT' | 'AUTH_LIMIT'

type Binding = { limit(options: { key: string }): Promise<{ success: boolean }> }

/** Whether `key` (an account id or an address) is still under the limit. */
export async function under_limit(
	name: Limiter,
	key: string,
	bindings: Partial<Record<Limiter, Binding>> = env,
) {
	// A runtime without the binding (unit tests) has nothing to count with.
	const limiter = bindings[name]
	if (!limiter) return true
	return (await limiter.limit({ key })).success
}

/** Refuse with a 429 once `key` is over the limit. */
export async function limit(name: Limiter, key: string) {
	if (!(await under_limit(name, key))) error(429, 'Too many requests.')
}
