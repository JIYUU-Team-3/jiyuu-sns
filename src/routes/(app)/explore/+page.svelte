<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import { get_trending, get_who_to_follow } from '#lib/search/search.remote'
	import SearchBox from '#lib/search/SearchBox.svelte'
	import TagRow from '#lib/search/TagRow.svelte'
	import UserRow from '#lib/search/UserRow.svelte'
	import PageBar from '../PageBar.svelte'

	const trending = $derived(await get_trending(5))
	const people = $derived(await get_who_to_follow(10))
</script>

<svelte:head><title>{m.site_page_title({ page: m.app_explore() })}</title></svelte:head>

<PageBar title={m.app_explore()}>
	<div class="box"><SearchBox /></div>
</PageBar>

<section aria-labelledby="trending-h">
	<h2 class="section-h" id="trending-h">{m.explore_trending()}</h2>
	{#each trending as tag (tag.tag)}
		<TagRow {tag} />
	{:else}
		<p class="none">{m.explore_trending_empty()}</p>
	{/each}
</section>

<section aria-labelledby="follow-h">
	<h2 class="section-h" id="follow-h">{m.explore_who_to_follow()}</h2>
	{#each people as user (user.id)}
		<UserRow {user} />
	{:else}
		<p class="none">{m.explore_who_to_follow_empty()}</p>
	{/each}
</section>

<style>
	.box {
		padding: 8px 16px;
	}
	.section-h {
		font-size: 20px;
		font-weight: 800;
		padding: 12px 16px;
		margin: 0;
		letter-spacing: -0.01em;
	}
	section + section {
		margin-top: 8px;
		border-top: 1px solid var(--line);
	}
	.none {
		color: var(--text-2);
		padding: 0 16px 16px;
		margin: 0;
	}
</style>
