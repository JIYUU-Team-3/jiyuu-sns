import { createSubscriber, SvelteMap, SvelteSet } from 'svelte/reactivity'
import type { PostView } from './types'

/*
 * Browser-only state shared by every list on the page. Nothing writes to it during SSR (writes
 * happen in event handlers), so the module-level instances never leak between requests.
 */

export type ComposerTask =
	{ kind: 'new' } | { kind: 'reply'; post: PostView } | { kind: 'edit'; post: PostView }

let composer_task = $state<ComposerTask | undefined>()

/** The modal composer: `New post`, reply from a card, or editing one of your posts. */
export const composer = {
	get task() {
		return composer_task
	},
	open(task: ComposerTask) {
		composer_task = task
	},
	close() {
		composer_task = undefined
	},
}

/**
 * Posts deleted in this tab. Every list hides them at once, instead of refetching each page
 * that might contain one.
 */
export const deleted_posts = new SvelteSet<string>()

/** New text for posts edited in this tab, shown until their lists refetch. */
export const edited_posts = new SvelteMap<string, string>()

const subscribe = createSubscriber((update) => {
	const timer = setInterval(update, 30_000)
	return () => clearInterval(timer)
})

/** The current time, re-read every 30 seconds by whatever shows it, so "3m" ages in place. */
export function current_time() {
	subscribe()
	return Date.now()
}

/**
 * Likes changed in this tab, so every copy of a post (feed card, focus post, stats row) flips
 * together without refetching.
 */
export const liked_posts = new SvelteMap<string, { liked: boolean; likes: number }>()

/** The viewer's like state for a post, including anything changed in this tab. */
export function like_state(post: PostView) {
	return liked_posts.get(post.id) ?? { liked: post.liked, likes: post.likes }
}
