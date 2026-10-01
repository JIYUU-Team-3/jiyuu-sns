<script lang="ts">
	import { onMount } from 'svelte'
	import { page } from '$app/state'
	import { messages_href } from '#lib/messages/links'
	import { get_unread_messages } from '#lib/messages/messages.remote'
	import { notifications_href } from '#lib/notifications/links'
	import { get_unread_count } from '#lib/notifications/notifications.remote'
	import { m } from '#lib/paraglide/messages.js'
	import { profile_href } from '#lib/profiles/links'
	import { morph_profile_edit } from '#lib/profiles/morph'
	import { composer } from '#lib/posts/state.svelte'
	import { explore_href } from '#lib/search/links'
	import Icon from '#lib/ui/Icon.svelte'
	import Toast from '#lib/ui/Toast.svelte'
	import { home_href } from '../(public)/links'
	import SiteFooter from '../(public)/SiteFooter.svelte'
	import Wordmark from '../(public)/Wordmark.svelte'
	import AccountMenu from './AccountMenu.svelte'
	import ComposerHost from './ComposerHost.svelte'
	import RailDiscover from './RailDiscover.svelte'
	import type { LayoutProps } from './$types'

	let { data, children }: LayoutProps = $props()

	morph_profile_edit()

	const on_home = $derived(page.route.id === '/(app)')
	const on_explore = $derived(
		page.route.id === '/(app)/explore' || page.route.id === '/(app)/search',
	)
	const on_notifications = $derived(page.route.id === '/(app)/notifications')
	const on_messages = $derived(page.route.id?.startsWith('/(app)/messages') ?? false)
	const in_chat = $derived(page.route.id === '/(app)/messages/[id]')

	const unread = $derived(await get_unread_count().catch(() => 0))
	const unread_label = $derived(unread >= 100 ? '99+' : String(unread))
	const unread_dms = $derived(await get_unread_messages().catch(() => 0))
	const unread_dms_label = $derived(unread_dms >= 100 ? '99+' : String(unread_dms))

	// New notifications arrive while the tab is open; check once a minute when it's visible.
	// With push on, the service worker also says the moment one arrives.
	onMount(() => {
		const refresh = () => get_unread_count().refresh()
		const timer = setInterval(() => {
			if (document.visibilityState === 'visible') refresh()
		}, 60_000)
		const dm_timer = setInterval(() => {
			if (document.visibilityState === 'visible') get_unread_messages().refresh()
		}, 30_000)
		const onmessage = (event: MessageEvent) => {
			if (event.data?.type === 'notification') refresh()
		}
		navigator.serviceWorker?.addEventListener('message', onmessage)
		return () => {
			clearInterval(timer)
			clearInterval(dm_timer)
			navigator.serviceWorker?.removeEventListener('message', onmessage)
		}
	})
	const on_own_profile = $derived(
		(page.route.id === '/(app)/u/[handle]' && page.params.handle === data.me.handle) ||
			page.route.id === '/(app)/settings/profile',
	)

	/** `n` opens the composer, as on X, unless the reader is typing or a dialog is open. */
	function onkeydown(event: KeyboardEvent) {
		if (event.key !== 'n' || event.metaKey || event.ctrlKey || event.altKey) return
		const target = event.target as HTMLElement
		if (target.closest('input, textarea, select, [contenteditable="true"], dialog')) return
		event.preventDefault()
		composer.open({ kind: 'new' })
	}
</script>

<svelte:window {onkeydown} />

<div class="shell" class:wide={on_messages} class:chat={in_chat}>
	<nav class="side" aria-label={m.app_home()}>
		<a class="brand" href={home_href()} aria-label="Jiyuu"><Wordmark /></a>
		<div class="nav">
			<!-- Bookmarks joins as its feature lands. -->
			<a class="nav-item" href={home_href()} aria-current={on_home ? 'page' : undefined}>
				<Icon name="home" size="lg" /><span class="lbl">{m.app_home()}</span>
			</a>
			<a class="nav-item" href={explore_href()} aria-current={on_explore ? 'page' : undefined}>
				<Icon name="search" size="lg" /><span class="lbl">{m.app_explore()}</span>
			</a>
			<a
				class="nav-item"
				href={notifications_href()}
				aria-current={on_notifications ? 'page' : undefined}
			>
				<span class="ico-wrap">
					<Icon name="bell" size="lg" />
					{#if unread}<span class="badge" aria-hidden="true">{unread_label}</span>{/if}
				</span>
				<span class="lbl">{m.app_notifications()}</span>
				{#if unread}<span class="visually-hidden">{m.app_unread({ count: unread_label })}</span
					>{/if}
			</a>
			<a class="nav-item" href={messages_href()} aria-current={on_messages ? 'page' : undefined}>
				<span class="ico-wrap">
					<Icon name="mail" size="lg" />
					{#if unread_dms}<span class="badge" aria-hidden="true">{unread_dms_label}</span>{/if}
				</span>
				<span class="lbl">{m.app_messages()}</span>
				{#if unread_dms}<span class="visually-hidden"
						>{m.app_unread({ count: unread_dms_label })}</span
					>{/if}
			</a>
			<a
				class="nav-item"
				href={profile_href(data.me.handle)}
				aria-current={on_own_profile ? 'page' : undefined}
			>
				<Icon name="user" size="lg" /><span class="lbl">{m.app_profile()}</span>
			</a>
		</div>
		<button
			type="button"
			class="btn btn-primary lg compose"
			onclick={() => composer.open({ kind: 'new' })}
		>
			<Icon name="compose" /><span class="lbl">{m.app_new_post()}</span>
		</button>
		<div class="foot"><AccountMenu me={data.me} /></div>
	</nav>

	<main class="main">{@render children()}</main>

	{#if !on_messages}
		<aside class="rail">
			<!-- Explore and Search already show all of this in the main column. -->
			{#if !on_explore}
				<svelte:boundary>
					<RailDiscover />
					{#snippet failed()}{/snippet}
				</svelte:boundary>
			{/if}
			<SiteFooter />
		</aside>
	{/if}
</div>

<nav class="tabbar" class:hidden={in_chat} aria-label={m.app_home()}>
	<a href={home_href()} aria-label={m.app_home()} aria-current={on_home ? 'page' : undefined}>
		<Icon name="home" size="lg" />
	</a>
	<a
		href={explore_href()}
		aria-label={m.app_explore()}
		aria-current={on_explore ? 'page' : undefined}
	>
		<Icon name="search" size="lg" />
	</a>
	<a
		href={notifications_href()}
		aria-label={unread
			? `${m.app_notifications()}, ${m.app_unread({ count: unread_label })}`
			: m.app_notifications()}
		aria-current={on_notifications ? 'page' : undefined}
	>
		<span class="ico-wrap">
			<Icon name="bell" size="lg" />
			{#if unread}<span class="badge" aria-hidden="true">{unread_label}</span>{/if}
		</span>
	</a>
	<a
		href={messages_href()}
		aria-label={unread_dms
			? `${m.app_messages()}, ${m.app_unread({ count: unread_dms_label })}`
			: m.app_messages()}
		aria-current={on_messages ? 'page' : undefined}
	>
		<span class="ico-wrap">
			<Icon name="mail" size="lg" />
			{#if unread_dms}<span class="badge" aria-hidden="true">{unread_dms_label}</span>{/if}
		</span>
	</a>
	<a
		href={profile_href(data.me.handle)}
		aria-label={m.app_profile()}
		aria-current={on_own_profile ? 'page' : undefined}
	>
		<Icon name="user" size="lg" />
	</a>
</nav>
<button
	type="button"
	class="fab"
	class:hidden={on_messages}
	aria-label={m.app_new_post()}
	onclick={() => composer.open({ kind: 'new' })}
>
	<Icon name="compose" size="lg" />
</button>

<ComposerHost me={data.me} />
<Toast />

<style>
	.shell {
		display: flex;
		justify-content: center;
		min-height: 100vh;
	}

	/* ---------- Side nav ---------- */
	.side {
		width: var(--nav-w);
		flex: none;
		position: sticky;
		top: 0;
		height: 100vh;
		display: flex;
		flex-direction: column;
		padding: 16px 20px 20px 12px;
		gap: 4px;
	}
	.brand {
		display: flex;
		align-items: center;
		min-height: 50px;
		padding: 6px 12px 18px;
	}
	.brand :global(.wordmark) {
		font-size: 28px;
	}
	.nav {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.nav-item {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 10px 12px;
		border-radius: 10px;
		font-size: 17px;
		transition: background-color 0.15s;
	}
	.nav-item:hover {
		background: var(--bg-2);
	}
	.nav-item[aria-current='page'] {
		font-weight: 700;
	}
	.ico-wrap {
		position: relative;
		display: flex;
	}
	.badge {
		position: absolute;
		top: -6px;
		left: 12px;
		min-width: 18px;
		height: 18px;
		padding: 0 5px;
		border-radius: 9px;
		background: var(--accent);
		color: var(--on-accent);
		font-size: 11px;
		font-weight: 700;
		line-height: 18px;
		text-align: center;
		box-shadow: 0 0 0 2px var(--bg);
	}
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	.compose {
		margin-top: 16px;
	}
	.foot {
		margin-top: auto;
	}

	/* ---------- Columns ---------- */
	.main {
		width: var(--main-w);
		flex: none;
		min-height: 100vh;
		border-left: 1px solid var(--line);
		border-right: 1px solid var(--line);
	}
	.rail {
		width: var(--rail-w);
		flex: none;
		padding: 8px 0 32px 28px;
		position: sticky;
		top: 0;
		height: 100vh;
		overflow-y: auto;
	}
	.shell.wide .main {
		width: calc(var(--main-w) + var(--rail-w));
	}
	.rail :global(.site-foot) {
		justify-content: flex-start;
	}

	/* ---------- Mobile chrome ---------- */
	.tabbar,
	.fab {
		display: none;
	}

	@media (max-width: 1180px) {
		.side {
			padding: 12px;
			align-items: center;
		}
		.lbl {
			display: none;
		}
		.brand {
			padding: 6px 0 16px;
		}
		/* The collapsed rail is 64px wide inside its padding. */
		.brand :global(.wordmark) {
			font-size: 19px;
		}
		.nav-item {
			padding: 12px;
		}
		.compose {
			width: 52px;
			height: 52px;
			padding: 0;
		}
	}
	@media (max-width: 1010px) {
		.rail {
			display: none;
		}
		.shell.wide .main {
			width: var(--main-w);
		}
	}
	@media (max-width: 700px) {
		.side {
			display: none;
		}
		.main,
		.shell.wide .main {
			width: 100%;
			border: 0;
			padding-bottom: calc(64px + env(safe-area-inset-bottom));
		}
		.shell.chat .main {
			padding-bottom: 0;
		}
		.tabbar {
			display: flex;
			position: fixed;
			left: 0;
			right: 0;
			bottom: 0;
			z-index: 40;
			height: calc(56px + env(safe-area-inset-bottom));
			padding-bottom: env(safe-area-inset-bottom);
			background: color-mix(in srgb, var(--bg) 92%, transparent);
			backdrop-filter: saturate(180%) blur(14px);
			-webkit-backdrop-filter: saturate(180%) blur(14px);
			border-top: 1px solid var(--line);
		}
		.tabbar a {
			flex: 1;
			display: grid;
			place-items: center;
			color: var(--text-2);
		}
		.tabbar a[aria-current='page'] {
			color: var(--text);
		}
		.tabbar a[aria-current='page'] :global(.ico) {
			stroke-width: 2.4;
		}
		.fab {
			display: grid;
			place-items: center;
			position: fixed;
			right: 16px;
			bottom: calc(72px + env(safe-area-inset-bottom));
			z-index: 41;
			width: 56px;
			height: 56px;
			border-radius: 50%;
			background: var(--accent-fill);
			color: var(--on-accent);
			box-shadow: var(--shadow-pop);
		}
		.tabbar.hidden,
		.fab.hidden {
			display: none;
		}
	}
</style>
