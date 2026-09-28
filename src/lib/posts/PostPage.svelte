<script lang="ts">
	import type { Snippet } from 'svelte'
	import type { RemoteQuery } from '$app/server'
	import { m } from '#lib/paraglide/messages.js'
	import PostCard from './PostCard.svelte'
	import { deleted_posts } from './state.svelte'
	import type { PostPage, PostView } from './types'

	let {
		query,
		first,
		last,
		show_replying,
		empty,
		onmore,
	}: {
		query: RemoteQuery<PostPage>
		first: boolean
		last: boolean
		show_replying: boolean
		empty?: Snippet
		onmore: (cursor: string) => void
	} = $props()

	const page = $derived(await query)
	const posts = $derived(page.posts.filter((post: PostView) => !deleted_posts.has(post.id)))
</script>

{#each posts as post (post.id)}
	<PostCard {post} {show_replying} />
{/each}

{#if first && !posts.length && !page.next}
	{@render empty?.()}
{/if}

{#if last && page.next}
	{@const next = page.next}
	<button type="button" class="more" onclick={() => onmore(next)}>{m.feed_load_more()}</button>
{/if}

<style>
	.more {
		display: block;
		width: 100%;
		padding: 16px;
		color: var(--accent-text);
		text-align: center;
		border-bottom: 1px solid var(--line);
		transition: background-color 0.15s;
	}
	.more:hover {
		background: var(--bg-2);
	}
</style>
