import { describe, expect, it, vi } from 'vitest'
import { acknowledge, deliver, RETRY_DELAYS } from './delivery'

const reply = (status: number) => () => Promise.resolve(new Response(null, { status }))

function run(answers: (number | Error)[]) {
	const post = vi.fn(() => {
		const next = answers.shift() ?? 204
		return next instanceof Error ? Promise.reject(next) : reply(next)()
	})
	const wait = vi.fn(() => Promise.resolve())
	const later = vi.fn(() => Promise.resolve())
	return { post, wait, later, done: deliver({ post, wait, later }) }
}

describe('acknowledge', () => {
	it('is done on success and on refusals a retry cannot fix', async () => {
		expect(await acknowledge(reply(204))).toBe(true)
		expect(await acknowledge(reply(401))).toBe(true)
	})

	it('wants a retry on rate limits, server errors and network failures', async () => {
		expect(await acknowledge(reply(429))).toBe(false)
		expect(await acknowledge(reply(503))).toBe(false)
		expect(await acknowledge(() => Promise.reject(new TypeError('offline')))).toBe(false)
	})
})

describe('deliver', () => {
	it('stops at the first success', async () => {
		const { post, wait, later, done } = run([204])
		expect(await done).toBe(true)
		expect(post).toHaveBeenCalledTimes(1)
		expect(wait).not.toHaveBeenCalled()
		expect(later).not.toHaveBeenCalled()
	})

	it('retries a 429 and a network failure until one goes through', async () => {
		const { post, wait, later, done } = run([429, new TypeError('offline'), 204])
		expect(await done).toBe(true)
		expect(post).toHaveBeenCalledTimes(3)
		expect(wait.mock.calls).toEqual(RETRY_DELAYS.map((ms) => [ms]))
		expect(later).not.toHaveBeenCalled()
	})

	it('hands over to a later retry when every attempt fails', async () => {
		const { post, later, done } = run([500, 500, 500])
		expect(await done).toBe(false)
		expect(post).toHaveBeenCalledTimes(RETRY_DELAYS.length + 1)
		expect(later).toHaveBeenCalledTimes(1)
	})
})
