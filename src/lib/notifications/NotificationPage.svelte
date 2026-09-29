<script lang="ts">
	import type { Snippet } from 'svelte'
	import type { RemoteQuery } from '$app/server'
	import { m } from '#lib/paraglide/messages.js'
	import { deleted_posts } from '#lib/posts/state.svelte'
	import NotificationRow from './NotificationRow.svelte'
	import type { NotificationPage } from './types'

	let {
		query,
		first,
		last,
		empty,
		onmore,
	}: {
		query: RemoteQuery<NotificationPage>
		first: boolean
		last: boolean
		empty?: Snippet
		onmore: (cursor: string) => void
	} = $props()

	const page = $derived(await query)
	const items = $derived(
		page.items.filter((item) => !item.post || !deleted_posts.has(item.post.id)),
	)
</script>

{#each items as item (item.id)}
	<NotificationRow {item} />
{/each}

{#if first && !items.length && !page.next}
	{@render empty?.()}
{/if}

{#if last && page.next}
	{@const next = page.next}
	<button type="button" class="more" onclick={() => onmore(next)}>{m.list_show_more()}</button>
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
