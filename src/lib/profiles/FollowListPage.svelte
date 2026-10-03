<script lang="ts">
	import type { Snippet } from 'svelte'
	import type { RemoteQuery } from '$app/server'
	import UserRow from '#lib/search/UserRow.svelte'
	import type { UserView } from '#lib/search/types'
	import type { PeoplePage } from './types'

	let {
		query,
		first,
		last,
		hide,
		show_follows_you,
		actions,
		empty,
		onmore,
	}: {
		query: RemoteQuery<PeoplePage>
		first: boolean
		last: boolean
		hide?: ReadonlySet<string>
		show_follows_you: boolean
		/** More actions for each account, such as removing a follower. */
		actions?: Snippet<[UserView]>
		empty?: Snippet
		onmore: (cursor: string) => void
	} = $props()

	const page = $derived(await query)
	const people = $derived(page.people.filter((user) => !hide?.has(user.id)))

	/** How far below the screen the next page starts loading, so it's there before the reader is. */
	const AHEAD = '800px'

	/** Attachment for the end of the list: asks for the next page as the reader nears it. */
	const load_next = (cursor: string) => (end: HTMLElement) => {
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) onmore(cursor)
			},
			{ rootMargin: `0px 0px ${AHEAD}` },
		)
		observer.observe(end)
		return () => observer.disconnect()
	}
</script>

{#each people as user (user.id)}
	{#if actions}
		<UserRow {user} {show_follows_you}>
			{#snippet menu()}{@render actions(user)}{/snippet}
		</UserRow>
	{:else}
		<UserRow {user} {show_follows_you} />
	{/if}
{/each}

{#if first && !people.length && !page.next}
	{@render empty?.()}
{/if}

{#if last && page.next}
	<div class="end" {@attach load_next(page.next)}></div>
{/if}

<style>
	.end {
		height: 1px;
	}
</style>
