<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import { m } from '#lib/paraglide/messages.js'
	import PostList from '#lib/posts/PostList.svelte'
	import { search_href, type SearchTab } from '#lib/search/links'
	import { search_people, search_posts, search_tags } from '#lib/search/search.remote'
	import SearchBox from '#lib/search/SearchBox.svelte'
	import TagRow from '#lib/search/TagRow.svelte'
	import UserRow from '#lib/search/UserRow.svelte'
	import EmptyState from '#lib/ui/EmptyState.svelte'
	import Tabs from '#lib/ui/Tabs.svelte'
	import PageBar from '../PageBar.svelte'

	const TABS: [SearchTab, () => string][] = [
		['top', m.search_top],
		['latest', m.search_latest],
		['people', m.search_people],
		['tags', m.search_tags],
	]

	const q = $derived((page.url.searchParams.get('q') ?? '').trim().slice(0, 100))
	const url_tab = $derived.by((): SearchTab => {
		const value = page.url.searchParams.get('tab')
		return TABS.some(([tab]) => tab === value) ? (value as SearchTab) : 'top'
	})

	// The tabs write here; the URL follows so a search can be shared and survives a reload.
	let tab = $derived(url_tab)
	$effect(() => {
		if (q && tab !== url_tab) goto(search_href(q, tab), { replace: true, reset: false })
	})
</script>

<svelte:head>
	<title>{m.site_page_title({ page: q ? `${q} – ${m.search_label()}` : m.search_label() })}</title>
</svelte:head>

<PageBar title={m.search_label()}>
	<div class="box"><SearchBox value={q} /></div>
	{#if q}<Tabs tabs={TABS} bind:value={tab} />{/if}
</PageBar>

{#snippet none()}
	<EmptyState title={m.search_empty_title({ q })} body={m.search_empty_body()} />
{/snippet}

{#if q}
	{#key `${q}\n${tab}`}
		<div role="tabpanel">
			{#if tab === 'people'}
				{@const people = await search_people(q)}
				{#each people as user (user.id)}
					<UserRow {user} />
				{:else}
					{@render none()}
				{/each}
			{:else if tab === 'tags'}
				{@const tags = await search_tags(q)}
				{#each tags as tag (tag.tag)}
					<TagRow {tag} />
				{:else}
					{@render none()}
				{/each}
			{:else}
				{@const posts_tab = tab}
				<!-- Like X, Top leads with the few closest people before the posts. -->
				{@const people =
					tab === 'top' && !q.startsWith('#') ? (await search_people(q)).slice(0, 3) : []}
				{#if people.length}
					<section class="people" aria-labelledby="people-h">
						<h2 id="people-h">{m.search_people()}</h2>
						{#each people as user (user.id)}
							<UserRow {user} />
						{/each}
						<button type="button" class="all" onclick={() => (tab = 'people')}
							>{m.search_view_all()}</button
						>
					</section>
				{/if}
				<PostList
					load={(cursor) =>
						search_posts(cursor ? { q, tab: posts_tab, cursor } : { q, tab: posts_tab })}
					empty={people.length ? undefined : none}
				/>
			{/if}
		</div>
	{/key}
{/if}

<style>
	.box {
		padding: 8px 16px;
	}
	.people {
		border-bottom: 1px solid var(--line);
	}
	.people h2 {
		font-size: 20px;
		font-weight: 800;
		padding: 12px 16px 4px;
		margin: 0;
	}
	.all {
		display: block;
		width: 100%;
		padding: 14px 16px;
		text-align: left;
		color: var(--accent-text);
		transition: background-color 0.15s;
	}
	.all:hover {
		background: var(--bg-2);
	}
</style>
