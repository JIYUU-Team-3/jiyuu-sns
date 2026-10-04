<script lang="ts" module>
	/** The pages reached in each remembered list, so coming back to one shows as much as before. */
	const remembered: Record<string, (string | undefined)[]> = {}
</script>

<script lang="ts">
	import { untrack, type Snippet } from 'svelte'
	import type { RemoteQuery } from '$app/server'
	import { m } from '#lib/paraglide/messages.js'
	import PostPage from './PostPage.svelte'
	import type { PostPage as Page } from './types'

	let {
		load,
		show_replying = true,
		hide,
		empty,
		remember,
	}: {
		/** The query for one page; `undefined` is the first. */
		load: (cursor?: string) => RemoteQuery<Page>
		show_replying?: boolean
		/** Posts already on screen above the list, such as ones just published. */
		hide?: ReadonlySet<string>
		/** Shown when the first page comes back empty. */
		empty?: Snippet
		/** A name for this list; leaving the page and coming back reopens the pages already reached. */
		remember?: string
	} = $props()

	/** One entry per page the reader has reached (nearing the end appends the next cursor). */
	let cursors = $state<(string | undefined)[]>(
		untrack(() => (remember && remembered[remember]) || [undefined]),
	)

	function more(next: string) {
		// The end of the list can come into view twice before the next page takes its place.
		if (cursors.includes(next)) return
		cursors.push(next)
		if (remember) remembered[remember] = [...cursors]
	}
</script>

{#snippet skeleton()}
	<div class="skeleton" role="status" aria-label={m.feed_loading()}>
		{#each [0, 1, 2] as row (row)}
			<div class="sk-row">
				<span class="sk-av"></span>
				<span class="sk-lines"><i></i><i></i><i></i></span>
			</div>
		{/each}
	</div>
{/snippet}

{#each cursors as cursor, i (cursor ?? '')}
	<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -- the boundary passes the error first -->
	{#snippet failed(_error: unknown, reset: () => void)}
		<div class="notice">
			<span>{m.feed_error()}</span>
			<button
				type="button"
				onclick={async () => {
					await load(cursor).refresh()
					reset()
				}}>{m.feed_retry()}</button
			>
		</div>
	{/snippet}

	<!--
		The first page has no pending state, so the server renders real posts. Later pages load on
		their own behind a skeleton, so scrolling on never blanks what is already on screen.
	-->
	<svelte:boundary {failed} pending={i === 0 ? undefined : skeleton}>
		<PostPage
			query={load(cursor)}
			first={i === 0}
			last={i === cursors.length - 1}
			{show_replying}
			{hide}
			{empty}
			onmore={more}
		/>
	</svelte:boundary>
{/each}

<style>
	.sk-row {
		display: flex;
		gap: 12px;
		padding: 12px 16px 16px;
		border-bottom: 1px solid var(--line);
	}
	.sk-av {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: var(--bg-3);
		flex: none;
	}
	.sk-lines {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding-top: 4px;
	}
	.sk-lines i {
		height: 12px;
		border-radius: 6px;
		background: var(--bg-3);
		animation: pulse 1.2s ease-in-out infinite alternate;
	}
	.sk-lines i:first-child {
		width: 40%;
	}
	.sk-lines i:last-child {
		width: 70%;
	}
	@keyframes pulse {
		to {
			opacity: 0.5;
		}
	}
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
