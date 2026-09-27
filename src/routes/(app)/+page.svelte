<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import { feed_arg } from '#lib/posts/args'
	import Composer from '#lib/posts/Composer.svelte'
	import PostList from '#lib/posts/PostList.svelte'
	import { get_feed } from '#lib/posts/posts.remote'
	import type { FeedTab } from '#lib/posts/types'
	import PageBar from './PageBar.svelte'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()

	let tab = $state<FeedTab>('for_you')

	const TABS: [FeedTab, () => string][] = [
		['for_you', m.feed_for_you],
		['following', m.feed_following],
	]
</script>

<svelte:head><title>{m.site_page_title({ page: m.app_home() })}</title></svelte:head>

<PageBar title={m.app_home()}>
	<div class="tabs" role="tablist">
		{#each TABS as [value, label] (value)}
			<button
				type="button"
				class="tab"
				role="tab"
				aria-selected={tab === value}
				onclick={() => (tab = value)}>{label()}</button
			>
		{/each}
	</div>
</PageBar>

<Composer task={{ kind: 'new' }} me={data.me} variant="inline" />

{#key tab}
	<div role="tabpanel">
		<PostList load={(cursor) => get_feed(feed_arg(tab, cursor))}>
			{#snippet empty()}
				<div class="empty">
					{#if tab === 'following'}
						<h2>{m.feed_following_empty_title()}</h2>
						<p>{m.feed_following_empty_body()}</p>
					{:else}
						<h2>{m.feed_empty_title()}</h2>
						<p>{m.feed_empty_body()}</p>
					{/if}
				</div>
			{/snippet}
		</PostList>
	</div>
{/key}

<style>
	.tabs {
		display: flex;
	}
	.tab {
		flex: 1;
		display: grid;
		place-items: center;
		height: 52px;
		color: var(--text-2);
		font-weight: 500;
		transition: background-color 0.15s;
		position: relative;
	}
	.tab:hover {
		background: var(--bg-2);
	}
	.tab[aria-selected='true'] {
		color: var(--text);
		font-weight: 700;
	}
	.tab[aria-selected='true']::after {
		content: '';
		position: absolute;
		bottom: 0;
		height: 4px;
		width: 56px;
		border-radius: 2px;
		background: var(--accent);
	}
	.empty {
		padding: 48px 32px;
		max-width: 420px;
		margin: 0 auto;
	}
	.empty h2 {
		font-size: 28px;
		line-height: 1.15;
		font-weight: 800;
		margin: 0 0 8px;
		letter-spacing: -0.02em;
	}
	.empty p {
		color: var(--text-2);
		margin: 0;
	}
</style>
