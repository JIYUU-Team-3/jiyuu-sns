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
	import EmptyState from '#lib/ui/EmptyState.svelte'
	import Tabs from '#lib/ui/Tabs.svelte'
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

<div class="tabbar"><Tabs tabs={TABS} bind:value={tab} /></div>

{#key `${profile.id}:${tab}`}
	<div role="tabpanel">
		<PostList
			load={(cursor) => get_author_posts(author_arg(profile.id, tab, cursor))}
			show_replying={tab === 'replies'}
		>
			{#snippet empty()}
				{#if tab === 'replies'}
					<EmptyState
						title={m.profile_empty_replies_title()}
						body={m.profile_empty_replies_body()}
					/>
				{:else if profile.mine}
					<EmptyState title={m.profile_empty_mine_title()} body={m.profile_empty_mine_body()} />
				{:else}
					<EmptyState
						title={m.profile_empty_title({ handle: profile.handle })}
						body={m.profile_empty_body()}
					/>
				{/if}
			{/snippet}
		</PostList>
	</div>
{/key}

<style>
	.tabbar {
		margin-top: 8px;
		border-bottom: 1px solid var(--line);
	}
</style>
