<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import { explore_href } from '#lib/search/links'
	import { get_trending, get_who_to_follow } from '#lib/search/search.remote'
	import SearchBox from '#lib/search/SearchBox.svelte'
	import TagRow from '#lib/search/TagRow.svelte'
	import UserRow from '#lib/search/UserRow.svelte'

	const trending = $derived(await get_trending(5).catch(() => []))
	const people = $derived(await get_who_to_follow(3).catch(() => []))
</script>

<div class="box"><SearchBox /></div>

{#if trending.length}
	<section class="card" aria-labelledby="rail-trending">
		<h2 id="rail-trending">{m.explore_trending()}</h2>
		{#each trending as tag (tag.tag)}<TagRow {tag} />{/each}
		<a class="more" href={explore_href()}>{m.list_show_more()}</a>
	</section>
{/if}

{#if people.length}
	<section class="card" aria-labelledby="rail-follow">
		<h2 id="rail-follow">{m.explore_who_to_follow()}</h2>
		{#each people as user (user.id)}<UserRow {user} show_bio={false} />{/each}
		<a class="more" href={explore_href()}>{m.list_show_more()}</a>
	</section>
{/if}

<style>
	.box {
		position: sticky;
		top: 0;
		z-index: 2;
		padding: 0 0 12px;
		background: var(--bg);
	}
	.card {
		border: 1px solid var(--line);
		border-radius: 16px;
		overflow: hidden;
		margin-bottom: 16px;
	}
	h2 {
		font-size: 20px;
		font-weight: 800;
		padding: 12px 16px;
		margin: 0;
	}
	.card :global(.trend:last-of-type) {
		border-bottom: 0;
	}
	.more {
		display: block;
		padding: 14px 16px;
		color: var(--accent-text);
		transition: background-color 0.15s;
	}
	.more:hover {
		background: var(--bg-2);
	}
</style>
