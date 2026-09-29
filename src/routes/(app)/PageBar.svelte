<script lang="ts">
	import type { Snippet } from 'svelte'
	import { page } from '$app/state'
	import { m } from '#lib/paraglide/messages.js'
	import Icon from '#lib/ui/Icon.svelte'
	import Wordmark from '../(public)/Wordmark.svelte'
	import { home_href } from '../(public)/links'
	import AccountMenu from './AccountMenu.svelte'

	let {
		title,
		subtitle,
		back = false,
		action,
		children,
	}: {
		title: string
		/** A smaller line under a back-arrow title, such as a profile's post count. */
		subtitle?: string
		/** A back arrow before the title, shown on every screen size (post pages). */
		back?: boolean
		/** A control at the end of a back-arrow bar, such as Save. */
		action?: Snippet
		/** Extra rows under the title, such as the feed tabs. */
		children?: Snippet
	} = $props()

	function go_back() {
		if (history.length > 1) history.back()
		else location.href = home_href()
	}
</script>

<header class="bar">
	{#if back}
		<div class="bar-row">
			<button type="button" class="icon-btn" aria-label={m.app_back()} onclick={go_back}>
				<Icon name="back" />
			</button>
			<div class="titles">
				<h1>{title}</h1>
				{#if subtitle}<p class="sub">{subtitle}</p>{/if}
			</div>
			{#if action}<div class="action">{@render action()}</div>{/if}
		</div>
	{:else}
		<!-- Phones get the account avatar and the wordmark; wider screens get the page title. -->
		<div class="bar-row mobile-top">
			<AccountMenu me={page.data.me} compact />
			<div class="center"><Wordmark /></div>
			<span class="spacer"></span>
		</div>
		<div class="bar-row desk-only"><h1>{title}</h1></div>
	{/if}
	{@render children?.()}
</header>

<style>
	.bar {
		position: sticky;
		top: 0;
		z-index: 20;
		background: color-mix(in srgb, var(--bg) 88%, transparent);
		backdrop-filter: saturate(180%) blur(14px);
		-webkit-backdrop-filter: saturate(180%) blur(14px);
		border-bottom: 1px solid var(--line);
	}
	.bar-row {
		display: flex;
		align-items: center;
		gap: 16px;
		min-height: 53px;
		padding: 0 16px;
	}
	h1 {
		font-size: 20px;
		font-weight: 800;
		margin: 0;
		letter-spacing: -0.01em;
		line-height: 1.2;
	}
	.titles {
		min-width: 0;
	}
	.titles h1 {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.action {
		margin-left: auto;
	}
	.sub {
		margin: 0;
		color: var(--text-2);
		font-size: 13px;
		line-height: 16px;
	}
	.mobile-top {
		display: none;
	}
	.center {
		flex: 1;
		display: flex;
		justify-content: center;
	}
	.spacer {
		width: 32px;
	}
	@media (max-width: 700px) {
		.mobile-top {
			display: flex;
		}
		.desk-only {
			display: none;
		}
	}
</style>
