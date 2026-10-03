<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity'
	import { m } from '#lib/paraglide/messages.js'
	import { follows_arg } from '#lib/posts/args'
	import { protected_from } from '#lib/profiles/access'
	import FollowerMenu from '#lib/profiles/FollowerMenu.svelte'
	import FollowList from '#lib/profiles/FollowList.svelte'
	import { followers_href, following_href } from '#lib/profiles/links'
	import { get_follows, get_profile } from '#lib/profiles/profiles.remote'
	import type { FollowSide } from '#lib/profiles/types'
	import { block } from '#lib/safety/actions'
	import type { UserView } from '#lib/search/types'
	import EmptyState from '#lib/ui/EmptyState.svelte'
	import PullToRefresh from '#lib/ui/PullToRefresh.svelte'
	import PageBar from '../../PageBar.svelte'

	let { handle, side }: { handle: string; side: FollowSide } = $props()

	const profile = $derived(await get_profile(handle))

	/** Followers removed here, gone from the list before the server's next page says so. */
	const removed = new SvelteSet<string>()

	/** Your own followers: everyone here follows you, and you may remove them. */
	const own_followers = $derived(profile.mine && side === 'followers')

	/** Bumped by a pull to refresh, so the list starts over from its first page. */
	let version = $state(0)

	async function refresh() {
		await Promise.all([
			get_profile(handle).refresh(),
			// A list that fails shows its own retry; one now hidden by a block has nothing to show.
			get_follows(follows_arg(profile.id, side))
				.refresh()
				.catch(() => {}),
		])
		version++
	}

	const TABS: [FollowSide, (handle: string) => string, () => string][] = [
		['following', following_href, m.follows_tab_following],
		['followers', followers_href, m.follows_tab_followers],
	]
</script>

<svelte:head>
	<title
		>{m.site_page_title({
			page:
				side === 'following'
					? m.follows_page_following({ name: profile.name })
					: m.follows_page_followers({ name: profile.name }),
		})}</title
	>
</svelte:head>

<PageBar title={profile.name} subtitle="@{profile.handle}" back>
	<nav class="tabs">
		{#each TABS as [tab, href, label] (tab)}
			<a
				class="tab"
				href={href(profile.handle)}
				aria-current={tab === side ? 'page' : undefined}
				data-sveltekit-replacestate
				data-sveltekit-noscroll>{label()}</a
			>
		{/each}
	</nav>
</PageBar>

<PullToRefresh onrefresh={refresh}>
	{#if profile.blocked}
		<EmptyState
			title={m.profile_blocked_title({ handle: profile.handle })}
			body={m.profile_blocked_body()}
		>
			<button
				type="button"
				class="btn btn-outline"
				onclick={() => block({ id: profile.id, handle: profile.handle }, false, false)}
				>{m.profile_unblock()}</button
			>
		</EmptyState>
	{:else if profile.blocks_you}
		<EmptyState
			title={m.profile_blocks_you_title({ handle: profile.handle })}
			body={m.profile_blocks_you_body({ handle: profile.handle })}
		/>
	{:else if protected_from(profile)}
		<EmptyState
			title={m.profile_protected_title()}
			body={m.profile_protected_body({ handle: profile.handle })}
		/>
	{:else}
		{#key `${profile.id}:${side}:${version}`}
			<FollowList
				load={(cursor) => get_follows(follows_arg(profile.id, side, cursor))}
				hide={removed}
				show_follows_you={!own_followers}
				actions={own_followers ? actions : undefined}
			>
				{#snippet empty()}
					{#if side === 'following'}
						<EmptyState
							title={profile.mine
								? m.follows_empty_following_mine_title()
								: m.follows_empty_following_title()}
							body={profile.mine
								? m.follows_empty_following_mine_body()
								: m.follows_empty_following_body({ handle: profile.handle })}
						/>
					{:else}
						<EmptyState
							title={profile.mine
								? m.follows_empty_followers_mine_title()
								: m.follows_empty_followers_title()}
							body={profile.mine
								? m.follows_empty_followers_mine_body()
								: m.follows_empty_followers_body({ handle: profile.handle })}
						/>
					{/if}
				{/snippet}
			</FollowList>
		{/key}
	{/if}
</PullToRefresh>

{#snippet actions(user: UserView)}
	<FollowerMenu {user} {removed} />
{/snippet}

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
		transition: color 0.15s;
		position: relative;
	}
	.tab:hover {
		color: var(--text);
	}
	.tab[aria-current='page'] {
		color: var(--text);
		font-weight: 700;
	}
	.tab[aria-current='page']::after {
		content: '';
		position: absolute;
		bottom: 0;
		height: 4px;
		width: 56px;
		border-radius: 2px;
		background: var(--accent);
	}
</style>
