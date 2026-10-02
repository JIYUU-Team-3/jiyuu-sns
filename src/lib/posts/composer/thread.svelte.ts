import type { ReplyAudience } from '#lib/safety/rules'
import { THREAD_MAX } from '../rules'
import { Draft } from './draft.svelte'

export class Thread {
	posts = $state<Draft[]>([])
	focus = $state(0)
	audience = $state<ReplyAudience>('everyone')

	constructor(first = new Draft()) {
		this.posts = [first]
	}

	readonly current = $derived(this.posts[this.focus] ?? this.posts[0])
	readonly ready = $derived(this.posts.every((post) => post.ready))
	readonly dirty = $derived(this.posts.some((post) => post.dirty))
	readonly can_add = $derived(this.ready && this.posts.length < THREAD_MAX)

	add() {
		if (!this.can_add) return
		this.posts.push(new Draft())
		this.focus = this.posts.length - 1
	}

	remove(index: number) {
		if (index < 1 || index >= this.posts.length) return
		this.posts[index].discard()
		this.posts.splice(index, 1)
		this.focus = Math.min(this.focus, this.posts.length - 1)
	}

	payload() {
		return this.posts.map((post) => post.payload())
	}

	clear() {
		for (const post of this.posts) post.clear()
		this.#reset()
	}

	discard() {
		for (const post of this.posts) post.discard()
		this.#reset()
	}

	#reset() {
		this.posts = [this.posts[0]]
		this.focus = 0
		this.audience = 'everyone'
	}
}
