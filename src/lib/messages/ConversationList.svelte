<script lang="ts">
	import { onMount, untrack } from 'svelte'
	import { m } from '#lib/paraglide/messages.js'
	import EmptyState from '#lib/ui/EmptyState.svelte'
	import Icon from '#lib/ui/Icon.svelte'
	import PullToRefresh from '#lib/ui/PullToRefresh.svelte'
	import { conversations_arg } from './args'
	import ConversationPage from './ConversationPage.svelte'
	import { get_conversations } from './messages.remote'
	import { inbox, new_message } from './state.svelte'

	let { active }: { active?: string } = $props()

	let q = $state('')
	let cursors = $state<(string | undefined)[]>([undefined])
	/** Bumped by a refresh, so a first page stuck on its error snippet gets a fresh boundary. */
	let generation = $state(0)

	async function refresh() {
		await get_conversations(conversations_arg()).refresh()
		cursors = [undefined]
		generation++
	}

	onMount(() => {
		const timer = setInterval(() => {
			if (document.visibilityState === 'visible' && !inbox.open)
				get_conversations(conversations_arg()).refresh()
		}, 10_000)
		return () => clearInterval(timer)
	})

	$effect(() => {
		if (!inbox.changes) return
		untrack(() => {
			get_conversations(conversations_arg())
				.refresh()
				.catch(() => {})
		})
	})
</script>

<header class="bar" data-clip-bar>
	<div class="bar-row">
		<h1>{m.app_messages()}</h1>
		<button
			type="button"
			class="icon-btn"
			aria-label={m.dm_new()}
			onclick={() => new_message.show()}
		>
			<Icon name="mail-plus" />
		</button>
	</div>
	<label class="search">
		<Icon name="search" size="sm" />
		<input type="search" placeholder={m.dm_search()} aria-label={m.dm_search()} bind:value={q} />
	</label>
</header>

<PullToRefresh onrefresh={refresh}>
	<nav aria-label={m.dm_list_label()}>
		{#each cursors as cursor, i (`${generation}:${cursor ?? ''}`)}
			<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -- the boundary passes the error first -->
			{#snippet failed(_error: unknown, reset: () => void)}
				<div class="notice">
					<span>{m.list_error()}</span>
					<button
						type="button"
						onclick={async () => {
							await get_conversations(conversations_arg(cursor)).refresh()
							reset()
						}}>{m.feed_retry()}</button
					>
				</div>
			{/snippet}

			<svelte:boundary {failed}>
				<ConversationPage
					query={get_conversations(conversations_arg(cursor))}
					{q}
					{active}
					first={i === 0}
					last={i === cursors.length - 1}
					onmore={(next) => cursors.push(next)}
				>
					{#snippet empty()}
						<EmptyState title={m.dm_empty_title()} body={m.dm_empty_body()}>
							<button type="button" class="btn btn-primary" onclick={() => new_message.show()}
								>{m.dm_new()}</button
							>
						</EmptyState>
					{/snippet}
				</ConversationPage>
			</svelte:boundary>
		{/each}
	</nav>
</PullToRefresh>

<style>
	.bar {
		position: sticky;
		top: 0;
		z-index: 20;
		padding-top: env(safe-area-inset-top);
		background: color-mix(in srgb, var(--bg) 88%, transparent);
		backdrop-filter: saturate(180%) blur(14px);
		border-bottom: 1px solid var(--line);
	}
	.bar-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-height: 53px;
		padding: 0 12px 0 16px;
	}
	h1 {
		font-size: 20px;
		font-weight: 800;
		margin: 0;
		letter-spacing: -0.01em;
	}
	.search {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 4px 16px 12px;
		height: 40px;
		padding: 0 14px;
		border-radius: 999px;
		background: var(--bg-3);
		color: var(--text-2);
	}
	.search:focus-within {
		box-shadow: 0 0 0 1px var(--accent);
		background: var(--bg);
	}
	.search input {
		flex: 1;
		min-width: 0;
		border: 0;
		outline: 0;
		background: none;
		color: var(--text);
	}
	/* iOS zooms the page into a focused field whose text is under 16px. */
	@media (pointer: coarse) {
		.search input {
			font-size: 16px;
		}
	}
	.search input::placeholder {
		color: var(--text-3);
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
