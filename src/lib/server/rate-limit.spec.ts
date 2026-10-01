import { describe, expect, it } from 'vitest'
import { under_limit } from './rate-limit'

/** A limiter that lets each key through `allowed` times. */
function limiter(allowed: number) {
	const seen = new Map<string, number>()
	return {
		async limit({ key }: { key: string }) {
			seen.set(key, (seen.get(key) ?? 0) + 1)
			return { success: seen.get(key)! <= allowed }
		},
	}
}

describe('under_limit', () => {
	it('counts each key on its own and refuses one past its limit', async () => {
		const bindings = { WRITE_LIMIT: limiter(2) }
		expect(await under_limit('WRITE_LIMIT', 'alice', bindings)).toBe(true)
		expect(await under_limit('WRITE_LIMIT', 'alice', bindings)).toBe(true)
		expect(await under_limit('WRITE_LIMIT', 'alice', bindings)).toBe(false)
		expect(await under_limit('WRITE_LIMIT', 'bob', bindings)).toBe(true)
	})

	it('lets everything through where the limiter is not bound', async () => {
		expect(await under_limit('UPLOAD_LIMIT', 'alice', {})).toBe(true)
	})
})
