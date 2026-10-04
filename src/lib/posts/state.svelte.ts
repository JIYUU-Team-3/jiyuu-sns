import { createSubscriber, SvelteMap, SvelteSet } from 'svelte/reactivity'
import type { Media, PollView, PostView } from './types'

/*
 * Browser-only state shared by every list on the page. Nothing writes to it during SSR (writes
 * happen in event handlers), so the module-level instances never leak between requests.
 */

export type ComposerTask =
	| { kind: 'new' }
	| { kind: 'reply'; post: PostView }
	| { kind: 'quote'; post: PostView }
	| { kind: 'edit'; post: PostView }

let composer_task = $state<ComposerTask | undefined>()

/** The modal composer: `New post`, reply or quote from a card, or editing one of your posts. */
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

let viewed = $state<{ post: PostView; index: number } | undefined>()

/** The full-screen photo viewer: a post, and which of its photos or videos to start on. */
export const viewer = {
	get current() {
		return viewed
	},
	open(post: PostView, index: number) {
		viewed = { post, index }
	},
	close() {
		viewed = undefined
	},
}

/**
 * Posts deleted in this tab. Every list hides them at once, instead of refetching each page
 * that might contain one.
 */
export const deleted_posts = new SvelteSet<string>()

export const hidden_authors = new SvelteSet<string>()

export type PostContent = { body: string; media: Media[] }

/** New text and photo order for posts edited in this tab, shown until their lists refetch. */
export const edited_posts = new SvelteMap<string, PostContent>()

/** A post's text and photos as the viewer last saw them, edits in this tab included. */
export function post_content(post: PostView): PostContent {
	return edited_posts.get(post.id) ?? { body: post.body, media: post.media }
}

/** What a quote of `post` will embed, as the viewer sees the post now. */
export function quote_of(post: PostView): NonNullable<PostView['quote']> {
	const { body, media } = post_content(post)
	const { id, created_at, author } = post
	// As on the post itself, its own author always sees the media.
	const sensitive = post.sensitive && !post.mine
	return { id, post: { id, body, created_at, author, media, sensitive } }
}

let timeline_version = $state(0)
let own_posts = $state<PostView[]>([])

/**
 * Home's timeline. Publishing reloads it from the first page and keeps the new post pinned on
 * top, since For You ranks by engagement and would otherwise bury a post with none yet.
 */
export const timeline = {
	/** Changes on every publish or reload; Home keys its list on it to start over from the first page. */
	get version() {
		return timeline_version
	},
	/** Posts published in this tab, newest first. */
	get fresh() {
		return own_posts
	},
	published(post: PostView) {
		own_posts = [post, ...own_posts]
		timeline_version++
	},
	/** Start over from the first page, for posts that arrived since it was loaded. */
	reload() {
		timeline_version++
	},
}

/** Poll results after the viewer voted in this tab, so every copy of the poll updates. */
export const voted_polls = new SvelteMap<string, PollView>()

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

/** Reposts changed in this tab, like `liked_posts`. */
export const reposted_posts = new SvelteMap<string, { reposted: boolean; reposts: number }>()

/** The viewer's repost state for a post, including anything changed in this tab. */
export function repost_state(post: PostView) {
	return reposted_posts.get(post.id) ?? { reposted: post.reposted, reposts: post.reposts }
}

/** The viewer's pin as changed in this tab: a post id, null once unpinned, undefined if untouched. */
export const my_pin = $state<{ id?: string | null }>({})

/** Whether the post is pinned to its author's profile, including the viewer's changes here. */
export function is_pinned(post: PostView) {
	return post.mine && my_pin.id !== undefined ? my_pin.id === post.id : post.pinned
}

/** Bookmarks changed in this tab, like `liked_posts`. */
export const bookmarked_posts = new SvelteMap<string, boolean>()

/** Whether the viewer saved a post, including anything changed in this tab. */
export function is_bookmarked(post: PostView) {
	return bookmarked_posts.get(post.id) ?? post.bookmarked
}
