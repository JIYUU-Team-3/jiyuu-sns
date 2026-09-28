<script lang="ts">
	import { getLocale } from '#lib/paraglide/runtime'
	import { m } from '#lib/paraglide/messages.js'
	import { author_arg } from '#lib/posts/args'
	import { format_count } from '#lib/posts/format'
	import PostList from '#lib/posts/PostList.svelte'
	import { get_author_posts } from '#lib/posts/posts.remote'
	import ProfileHeader from '#lib/profiles/ProfileHeader.svelte'
	import { get_profile } from '#lib/profiles/profiles.remote'
	import type { ProfileTab } from '#lib/profiles/types'
	import PageBar from '../../PageBar.svelte'
	import type { PageProps } from './$types'

	let { params }: PageProps = $props()

	const profile = $derived(await get_profile(params.handle))
	const count = $derived(format_count(profile.posts, getLocale()))

	let tab = $state<ProfileTab>('posts')

	const TABS: [ProfileTab, () => string][] = [
		['posts', m.profile_tab_posts],
		['replies', m.profile_tab_replies],
	]
</script>

<svelte:head>
	<title
		>{m.site_page_title({
			page: m.profile_page_title({ name: profile.name, handle: profile.handle }),
		})}</title
	>
</svelte:head>

<PageBar
	title={profile.name}
	subtitle={profile.posts === 1 ? m.profile_post({ count }) : m.profile_posts({ count })}
	back
/>

<ProfileHeader {profile} />

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

{#key `${profile.id}:${tab}`}
	<div role="tabpanel">
		<PostList
			load={(cursor) => get_author_posts(author_arg(profile.id, tab, cursor))}
			show_replying={tab === 'replies'}
		>
			{#snippet empty()}
				<div class="empty">
					{#if tab === 'replies'}
						<h2>{m.profile_empty_replies_title()}</h2>
						<p>{m.profile_empty_replies_body()}</p>
					{:else if profile.mine}
						<h2>{m.profile_empty_mine_title()}</h2>
						<p>{m.profile_empty_mine_body()}</p>
					{:else}
						<h2>{m.profile_empty_title({ handle: profile.handle })}</h2>
						<p>{m.profile_empty_body()}</p>
					{/if}
				</div>
			{/snippet}
		</PostList>
	</div>
{/key}

<style>
	.tabs {
		display: flex;
		margin-top: 8px;
		border-bottom: 1px solid var(--line);
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
		overflow-wrap: anywhere;
	}
	.empty p {
		color: var(--text-2);
		margin: 0;
	}
</style>
