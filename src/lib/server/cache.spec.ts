import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cached, seen_recently } from './cache'

/** The Cache API as Workers has it, kept in a map; enough for `match` and `put`. */
function fake_cache() {
	const stored = new Map<string, Response>()
	return {
		match: async (request: Request) => stored.get(request.url)?.clone(),
		put: async (request: Request, response: Response) => void stored.set(request.url, response),
	}
}

const global = globalThis as { caches?: unknown }

describe('cache', () => {
	beforeEach(() => {
		global.caches = { default: fake_cache() }
	})
	afterEach(() => {
		delete global.caches
	})

	it('computes a value once and answers from the cache after', async () => {
		let runs = 0
		const compute = async () => ({ runs: ++runs })
		expect(await cached('k', 60, compute)).toEqual({ runs: 1 })
		expect(await cached('k', 60, compute)).toEqual({ runs: 1 })
		expect(await cached('other', 60, compute)).toEqual({ runs: 2 })
	})

	it('keeps nothing a lookup marked as not worth keeping', async () => {
		let runs = 0
		const compute = async () => ++runs
		await cached('k', 60, compute, () => false)
		expect(await cached('k', 60, compute)).toBe(2)
	})

	it('lets a repeat through once, then keeps it quiet', async () => {
		expect(await seen_recently('pushed:like:a:b:p', 3600)).toBe(false)
		expect(await seen_recently('pushed:like:a:b:p', 3600)).toBe(true)
		expect(await seen_recently('pushed:like:a:b:q', 3600)).toBe(false)
	})

	it('without a cache, computes every time and never keeps anything quiet', async () => {
		delete global.caches
		let runs = 0
		await cached('k', 60, async () => ++runs)
		expect(await cached('k', 60, async () => ++runs)).toBe(2)
		expect(await seen_recently('k', 60)).toBe(false)
		expect(await seen_recently('k', 60)).toBe(false)
	})
})
