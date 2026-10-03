<script lang="ts">
	import type { Snippet } from 'svelte'
	import type { RemoteQuery } from '$app/server'
	import { m } from '#lib/paraglide/messages.js'
	import type { UserView } from '#lib/search/types'
	import FollowListPage from './FollowListPage.svelte'
	import type { PeoplePage } from './types'

	let {
		load,
		hide,
		show_follows_you = true,
		actions,
		empty,
	}: {
		/** The query for one page; `undefined` is the first. */
		load: (cursor?: string) => RemoteQuery<PeoplePage>
		/** Accounts already taken off the list here, such as a removed follower. */
		hide?: ReadonlySet<string>
		/** Off where everyone listed follows the viewer, such as your own followers. */
		show_follows_you?: boolean
		actions?: Snippet<[UserView]>
		/** Shown when the first page comes back empty. */
		empty?: Snippet
	} = $props()

	/** One entry per page the reader has reached (nearing the end appends the next cursor). */
	let cursors = $state<(string | undefined)[]>([undefined])
</script>

{#snippet skeleton()}
	<div role="status" aria-label={m.feed_loading()}>
		{#each [0, 1, 2] as row (row)}
			<div class="sk-row">
				<span class="sk-av"></span>
				<span class="sk-lines"><i></i><i></i></span>
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

	<!-- The first page renders on the server; later ones load behind a skeleton. -->
	<svelte:boundary {failed} pending={i === 0 ? undefined : skeleton}>
		<FollowListPage
			query={load(cursor)}
			first={i === 0}
			last={i === cursors.length - 1}
			{hide}
			{show_follows_you}
			{actions}
			{empty}
			onmore={(next) => {
				// The end of the list can come into view twice before the next page takes its place.
				if (!cursors.includes(next)) cursors.push(next)
			}}
		/>
	</svelte:boundary>
{/each}

<style>
	.sk-row {
		display: flex;
		gap: 12px;
		padding: 12px 16px;
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
		padding-top: 6px;
	}
	.sk-lines i {
		height: 12px;
		border-radius: 6px;
		background: var(--bg-3);
		animation: pulse 1.2s ease-in-out infinite alternate;
	}
	.sk-lines i:first-child {
		width: 35%;
	}
	.sk-lines i:last-child {
		width: 25%;
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
		color: var(--text-2);
	}
	.notice button {
		color: var(--accent-text);
		font-weight: 700;
	}
</style>
