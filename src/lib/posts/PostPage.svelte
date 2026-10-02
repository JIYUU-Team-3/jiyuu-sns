<script lang="ts">
	import type { Snippet } from 'svelte'
	import type { RemoteQuery } from '$app/server'
	import PostCard from './PostCard.svelte'
	import { deleted_posts, hidden_authors } from './state.svelte'
	import type { PostPage, PostView } from './types'

	let {
		query,
		first,
		last,
		show_replying,
		hide,
		empty,
		onmore,
	}: {
		query: RemoteQuery<PostPage>
		first: boolean
		last: boolean
		show_replying: boolean
		hide?: ReadonlySet<string>
		empty?: Snippet
		onmore: (cursor: string) => void
	} = $props()

	const page = $derived(await query)
	const posts = $derived(
		page.posts.filter(
			(post: PostView) =>
				!deleted_posts.has(post.id) && !hide?.has(post.id) && !hidden_authors.has(post.author.id),
		),
	)

	/** How far below the screen the next page starts loading, so it's there before the reader is. */
	const AHEAD = '800px'

	/** Attachment for the end of the list: asks for the next page as the reader nears it. */
	const load_next = (cursor: string) => (end: HTMLElement) => {
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) onmore(cursor)
			},
			{ rootMargin: `0px 0px ${AHEAD}` },
		)
		observer.observe(end)
		return () => observer.disconnect()
	}
</script>

{#each posts as post (post.id)}
	<PostCard {post} {show_replying} />
{/each}

{#if first && !posts.length && !page.next}
	{@render empty?.()}
{/if}

{#if last && page.next}
	<div class="end" {@attach load_next(page.next)}></div>
{/if}

<style>
	.end {
		height: 1px;
	}
</style>
