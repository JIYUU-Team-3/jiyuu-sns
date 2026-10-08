<script lang="ts" module>
	import type { FeedTab } from '#lib/posts/types'

	/** The tab Home was left on, so coming back from another page doesn't reset it to For You. */
	let last_tab: FeedTab = 'for_you'
</script>

<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import { feed_arg } from '#lib/posts/args'
	import Composer from '#lib/posts/Composer.svelte'
	import NewPostsPill from '#lib/posts/NewPostsPill.svelte'
	import PostCard from '#lib/posts/PostCard.svelte'
	import PostList from '#lib/posts/PostList.svelte'
	import { get_feed } from '#lib/posts/posts.remote'
	import { refresh_feed } from '#lib/posts/refresh'
	import { deleted_posts, timeline } from '#lib/posts/state.svelte'
	import EmptyState from '#lib/ui/EmptyState.svelte'
	import PullToRefresh from '#lib/ui/PullToRefresh.svelte'
	import Tabs from '#lib/ui/Tabs.svelte'
	import PageBar from './PageBar.svelte'
	import { keep_scroll } from './restore-scroll'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()

	let tab = $state<FeedTab>(last_tab)
	$effect(() => {
		last_tab = tab
	})

	const TABS: [FeedTab, () => string][] = [
		['for_you', m.feed_for_you],
		['following', m.feed_following],
	]

	const fresh = $derived(timeline.fresh.filter((post) => !deleted_posts.has(post.id)))
	const fresh_ids = $derived(new Set(fresh.map((post) => post.id)))

	// A new post reloads the timeline from the top, where it's pinned; so does the "posted" pill.
	// Only a reload that happens here: one from before this visit is no reason to leave the spot.
	let shown = timeline.version
	$effect(() => {
		if (timeline.version === shown) return
		shown = timeline.version
		scrollTo({ top: 0, behavior: 'smooth' })
	})

	// A timeline reloaded while the reader was away starts over from the top.
	keep_scroll('/(app)', () => String(timeline.version))
</script>

<svelte:head><title>{m.site_page_title({ page: m.app_home() })}</title></svelte:head>

<PageBar title={m.app_home()}>
	<Tabs tabs={TABS} bind:value={tab} />
	<NewPostsPill {tab} />
</PageBar>

<PullToRefresh onrefresh={() => refresh_feed(tab)}>
	<Composer task={{ kind: 'new' }} me={data.me} variant="inline" />

	{#key `${tab}:${timeline.version}`}
		<div role="tabpanel">
			{#each fresh as post (post.id)}
				<PostCard {post} />
			{/each}
			<PostList
				load={(cursor) => get_feed(feed_arg(tab, cursor))}
				hide={fresh_ids}
				remember="home:{tab}:{timeline.version}"
				server_render={false}
			>
				{#snippet empty()}
					{#if fresh.length}
						<!-- The new posts above are the timeline for now. -->
					{:else if tab === 'following'}
						<EmptyState title={m.feed_following_empty_title()} body={m.feed_following_empty_body()}>
							<button type="button" class="btn btn-primary" onclick={() => (tab = 'for_you')}
								>{m.feed_following_empty_action()}</button
							>
						</EmptyState>
					{:else}
						<EmptyState title={m.feed_empty_title()} body={m.feed_empty_body()} />
					{/if}
				{/snippet}
			</PostList>
		</div>
	{/key}
</PullToRefresh>
