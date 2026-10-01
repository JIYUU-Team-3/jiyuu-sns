<script lang="ts">
	import type { Snippet } from 'svelte'
	import type { RemoteQuery } from '$app/server'
	import { m } from '#lib/paraglide/messages.js'
	import ConversationRow from './ConversationRow.svelte'
	import { conversation_title } from './rules'
	import type { ConversationPage } from './types'

	let {
		query,
		q,
		active,
		first,
		last,
		empty,
		onmore,
	}: {
		query: RemoteQuery<ConversationPage>
		q: string
		active?: string
		first: boolean
		last: boolean
		empty: Snippet
		onmore: (cursor: string) => void
	} = $props()

	const page = $derived(await query)
	const needle = $derived(q.trim().toLowerCase())
	const items = $derived(
		needle
			? page.items.filter((convo) =>
					[conversation_title(convo, ''), ...convo.members.map((member) => member.handle ?? '')]
						.join(' ')
						.toLowerCase()
						.includes(needle),
				)
			: page.items,
	)
</script>

{#each items as convo (convo.id)}
	<ConversationRow {convo} active={convo.id === active} />
{/each}

{#if first && !items.length && !page.next}
	{#if needle}
		<p class="note">{m.dm_no_results({ q: q.trim() })}</p>
	{:else}
		{@render empty()}
	{/if}
{/if}

{#if last && page.next}
	{@const next = page.next}
	<button type="button" class="more" onclick={() => onmore(next)}>{m.list_show_more()}</button>
{/if}

<style>
	.note {
		margin: 0;
		padding: 24px 16px;
		color: var(--text-2);
		overflow-wrap: anywhere;
	}
	.more {
		display: block;
		width: 100%;
		padding: 16px;
		color: var(--accent-text);
		text-align: center;
		transition: background-color 0.15s;
	}
	.more:hover {
		background: var(--bg-2);
	}
</style>
