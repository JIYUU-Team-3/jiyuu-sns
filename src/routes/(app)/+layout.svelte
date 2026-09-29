<script lang="ts">
	import { page } from '$app/state'
	import { m } from '#lib/paraglide/messages.js'
	import { profile_href } from '#lib/profiles/links'
	import { morph_profile_edit } from '#lib/profiles/morph'
	import { composer } from '#lib/posts/state.svelte'
	import Icon from '#lib/ui/Icon.svelte'
	import Toast from '#lib/ui/Toast.svelte'
	import { home_href } from '../(public)/links'
	import Mark from '../(public)/Mark.svelte'
	import SiteFooter from '../(public)/SiteFooter.svelte'
	import Wordmark from '../(public)/Wordmark.svelte'
	import AccountMenu from './AccountMenu.svelte'
	import ComposerHost from './ComposerHost.svelte'
	import type { LayoutProps } from './$types'

	let { data, children }: LayoutProps = $props()

	morph_profile_edit()

	const on_home = $derived(page.route.id === '/(app)')
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

<div class="shell">
	<nav class="side" aria-label={m.app_home()}>
		<a class="brand" href={home_href()} aria-label="Jiyuu"><Mark /><Wordmark /></a>
		<div class="nav">
			<!-- Explore, Notifications, Messages and Bookmarks join as their features land. -->
			<a class="nav-item" href={home_href()} aria-current={on_home ? 'page' : undefined}>
				<Icon name="home" size="lg" /><span class="lbl">{m.app_home()}</span>
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

	<aside class="rail">
		<SiteFooter />
	</aside>
</div>

<nav class="tabbar" aria-label={m.app_home()}>
	<a href={home_href()} aria-label={m.app_home()} aria-current={on_home ? 'page' : undefined}>
		<Icon name="home" size="lg" />
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
		gap: 10px;
		padding: 6px 12px 18px;
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
		.brand :global(.wordmark),
		.lbl {
			display: none;
		}
		.brand {
			padding: 6px 0 16px;
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
	}
	@media (max-width: 700px) {
		.side {
			display: none;
		}
		.main {
			width: 100%;
			border: 0;
			padding-bottom: calc(64px + env(safe-area-inset-bottom));
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
			color: #fff;
			box-shadow: var(--shadow-pop);
		}
	}
</style>
