import { describe, expect, it } from 'vitest'
import { THREAD_MAX } from '../rules'
import { Thread } from './thread.svelte'

describe('Thread', () => {
	it('adds a post only once every post is ready', () => {
		const thread = new Thread()
		thread.add()
		expect(thread.posts).toHaveLength(1)
		thread.posts[0].text = 'first'
		thread.add()
		expect(thread.posts).toHaveLength(2)
		expect(thread.focus).toBe(1)
		expect(thread.ready).toBe(false)
	})

	it('stops at the thread limit', () => {
		const thread = new Thread()
		for (let i = 0; i < THREAD_MAX + 2; i++) {
			thread.current.text = `post ${i}`
			thread.add()
		}
		expect(thread.posts).toHaveLength(THREAD_MAX)
		expect(thread.can_add).toBe(false)
	})

	it('removes follow-up posts but never the first', () => {
		const thread = new Thread()
		thread.posts[0].text = 'one'
		thread.add()
		thread.current.text = 'two'
		thread.remove(0)
		expect(thread.posts).toHaveLength(2)
		thread.remove(1)
		expect(thread.posts.map((post) => post.text)).toEqual(['one'])
		expect(thread.focus).toBe(0)
	})

	it('sends every post in order and clears back to one', () => {
		const thread = new Thread()
		thread.posts[0].text = ' one '
		thread.add()
		thread.current.text = 'two'
		expect(thread.payload().map((post) => post.body)).toEqual(['one', 'two'])
		expect(thread.dirty).toBe(true)
		thread.clear()
		expect(thread.posts).toHaveLength(1)
		expect(thread.dirty).toBe(false)
	})
})
