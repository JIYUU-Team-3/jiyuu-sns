<script lang="ts">
	import type { Snippet } from 'svelte'
	import type { RemoteQuery } from '$app/server'
	import { m } from '#lib/paraglide/messages.js'
	import NotificationPage from './NotificationPage.svelte'
	import type { NotificationPage as Page } from './types'

	let {
		load,
		empty,
	}: {
		/** The query for one page; `undefined` is the first. */
		load: (cursor?: string) => RemoteQuery<Page>
		empty?: Snippet
	} = $props()

	/** One entry per page the reader has asked for, as in the post lists. */
	let cursors = $state<(string | undefined)[]>([undefined])
</script>

{#each cursors as cursor, i (cursor ?? '')}
	<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -- the boundary passes the error first -->
	{#snippet failed(_error: unknown, reset: () => void)}
		<div class="notice">
			<span>{m.list_error()}</span>
			<button
				type="button"
				onclick={async () => {
					await load(cursor).refresh()
					reset()
				}}>{m.feed_retry()}</button
			>
		</div>
	{/snippet}

	<svelte:boundary {failed}>
		<NotificationPage
			query={load(cursor)}
			first={i === 0}
			last={i === cursors.length - 1}
			{empty}
			onmore={(next) => cursors.push(next)}
		/>
	</svelte:boundary>
{/each}

<style>
	.notice {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 14px 16px;
		border-bottom: 1px solid var(--line);
		color: var(--text-2);
	}
	.notice button {
		color: var(--accent-text);
		font-weight: 700;
	}
</style>
