<script lang="ts">
	import { onMount } from 'svelte'
	import { m } from '#lib/paraglide/messages.js'
	import Avatar from '#lib/ui/Avatar.svelte'
	import Icon from '#lib/ui/Icon.svelte'
	import { feed_arg } from './args'
	import { get_feed, get_new_posts } from './posts.remote'
	import { refresh_feed } from './refresh'
	import type { FeedTab } from './types'

	let { tab }: { tab: FeedTab } = $props()

	/** How often to ask for new posts while the tab is visible. */
	const CHECK_EVERY = 10_000
	/** This long without a scroll event and the reader has stopped. */
	const SCROLL_REST = 250

	let mounted = $state(false)
	let scrolling = $state(false)
	let shown = $state(false)
	let loading = $state(false)

	// The same query the list shows, so "new" means newer than what is on screen. Only in the
	// browser: Home's list loads there, and asking here on the server would rank the feed anyway.
	const since = $derived(mounted ? (await get_feed(feed_arg(tab))).as_of : undefined)
	const check = $derived(since === undefined ? undefined : { tab, since })
	// Nothing can be new while the server renders the page.
	const authors = $derived(check ? await get_new_posts(check).catch(() => []) : [])

	onMount(() => {
		mounted = true
		const refresh = () => {
			if (check && document.visibilityState === 'visible') get_new_posts(check).refresh()
		}
		const timer = setInterval(refresh, CHECK_EVERY)
		document.addEventListener('visibilitychange', refresh)

		let rest: ReturnType<typeof setTimeout> | undefined
		const onscroll = () => {
			scrolling = true
			clearTimeout(rest)
			rest = setTimeout(() => (scrolling = false), SCROLL_REST)
		}
		addEventListener('scroll', onscroll, { passive: true })
		return () => {
			clearInterval(timer)
			clearTimeout(rest)
			document.removeEventListener('visibilitychange', refresh)
			removeEventListener('scroll', onscroll)
		}
	})

	// Never pops up under a moving thumb; once it's there it stays until used.
	$effect(() => {
		if (!authors.length) shown = false
		else if (!scrolling) shown = true
	})

	async function show() {
		loading = true
		try {
			await refresh_feed(tab)
		} finally {
			loading = false
		}
	}
</script>

{#if shown}
	<!-- Phones show only the faces and the arrow, so the name is on the button itself. -->
	<button type="button" class="pill" aria-label={m.feed_posted()} disabled={loading} onclick={show}>
		<span class="stack">
			{#each authors as author (author.id)}
				<Avatar name={author.name} seed={author.id} image={author.image} size={24} />
			{/each}
		</span>
		<span class="lbl">{m.feed_posted()}</span>
		<Icon name="arrow-up" size="sm" />
	</button>
{/if}

<style>
	.pill {
		position: absolute;
		top: calc(100% + 12px);
		left: 50%;
		transform: translateX(-50%);
		width: max-content;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 12px 6px 8px;
		border-radius: 999px;
		background: var(--accent-fill);
		color: var(--on-accent);
		font-size: 14px;
		font-weight: 700;
		box-shadow: var(--shadow-pop);
		transition:
			background-color 0.15s,
			opacity 0.25s,
			translate 0.35s var(--ease-out);
		@starting-style {
			opacity: 0;
			translate: 0 -6px;
		}
	}
	.pill:hover {
		background: var(--accent-fill-hover);
	}
	.stack {
		display: flex;
	}
	.stack :global(.av) {
		box-shadow: 0 0 0 2px var(--accent-fill);
	}
	.stack :global(.av + .av) {
		margin-left: -8px;
	}
	.pill :global(.ico) {
		stroke-width: 2.4;
	}
	@media (max-width: 700px) {
		.lbl {
			display: none;
		}
	}
</style>
