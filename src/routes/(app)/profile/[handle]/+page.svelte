<script lang="ts">
	import { format_month_year } from '#lib/format-date'
	import { getLocale, localizeHref } from '#lib/paraglide/runtime'
	import { m } from '#lib/paraglide/messages.js'
	import { author_arg } from '#lib/posts/args'
	import { format_count } from '#lib/posts/format'
	import PostList from '#lib/posts/PostList.svelte'
	import PostText from '#lib/posts/PostText.svelte'
	import { get_author_posts } from '#lib/posts/posts.remote'
	import type { ProfileTab } from '#lib/profiles/types'
	import Avatar from '#lib/ui/Avatar.svelte'
	import Icon from '#lib/ui/Icon.svelte'
	import PageBar from '../../PageBar.svelte'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()

	const profile = $derived(data.profile)
	const count = $derived(format_count(profile.posts, getLocale()))

	let tab = $state<ProfileTab>('posts')

	/** The header image fell back to the plain fill. */
	let header_broken = $state(false)

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

<div class="header">
	{#if profile.header && !header_broken}
		<img
			src={profile.header}
			alt={m.profile_header_alt({ name: profile.name })}
			onerror={() => (header_broken = true)}
		/>
	{/if}
</div>

<div class="top">
	<div class="photo" role="img" aria-label={m.profile_avatar_alt({ name: profile.name })}>
		<Avatar name={profile.name} seed={profile.id} image={profile.image} size={134} />
	</div>
	{#if profile.mine}
		<a class="btn btn-outline actions" href={localizeHref('/settings/profile')}
			>{m.profile_edit()}</a
		>
	{/if}

	<h2 class="name">{profile.name}</h2>
	<p class="handle">@{profile.handle}</p>
	{#if profile.bio}<p class="bio"><PostText body={profile.bio} /></p>{/if}

	<p class="meta">
		<Icon name="calendar" size="sm" />
		<time datetime={new Date(profile.joined_at).toISOString()}
			>{m.profile_joined({ date: format_month_year(profile.joined_at, getLocale()) })}</time
		>
	</p>

	<!-- Plain counts until the follow lists have pages to link to. -->
	<p class="counts num">
		<span><b>{format_count(profile.following, getLocale())}</b> {m.profile_following()}</span>
		<span><b>{format_count(profile.followers, getLocale())}</b> {m.profile_followers()}</span>
	</p>
</div>

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
	.header {
		aspect-ratio: 3 / 1;
		background: var(--img-fallback);
		overflow: hidden;
	}
	.header img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.top {
		position: relative;
		padding: 12px 16px 0;
	}
	.photo {
		width: max-content;
		margin-top: -80px;
		border: 4px solid var(--bg);
		border-radius: 50%;
		background: var(--bg);
	}
	.actions {
		position: absolute;
		top: 12px;
		right: 16px;
	}
	.name {
		margin: 12px 0 0;
		font-size: 20px;
		font-weight: 800;
		letter-spacing: -0.01em;
		line-height: 1.2;
		overflow-wrap: anywhere;
	}
	.handle {
		margin: 0;
		color: var(--text-2);
	}
	.bio {
		margin: 12px 0 0;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.meta {
		display: flex;
		align-items: center;
		gap: 4px;
		margin: 12px 0 0;
		color: var(--text-2);
	}
	.counts {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 20px;
		margin: 12px 0 0;
		color: var(--text-2);
	}
	.counts b {
		color: var(--text);
	}

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

	@media (max-width: 700px) {
		.photo {
			margin-top: -52px;
		}
		.photo :global(.av) {
			width: 84px;
			height: 84px;
			font-size: 32px;
		}
	}
</style>
