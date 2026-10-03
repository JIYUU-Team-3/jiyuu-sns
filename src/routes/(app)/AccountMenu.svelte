<script lang="ts">
	import { page } from '$app/state'
	import { mod_href } from '#lib/moderation/links'
	import ModeratorBadge from '#lib/moderation/ModeratorBadge.svelte'
	import { m } from '#lib/paraglide/messages.js'
	import { bookmarks_href } from '#lib/posts/links'
	import type { Author } from '#lib/posts/types'
	import { profile_href } from '#lib/profiles/links'
	import { settings_href } from '#lib/settings/links'
	import Avatar from '#lib/ui/Avatar.svelte'
	import Icon from '#lib/ui/Icon.svelte'
	import Menu from '#lib/ui/Menu.svelte'
	import { home_href } from '../(public)/links'
	import { sign_out } from './sign-out'

	let { me, compact = false }: { me: Author & { handle: string }; compact?: boolean } = $props()
</script>

<Menu label={m.app_account_menu()} placement={compact ? 'cover-start' : 'above'}>
	{#snippet trigger(props)}
		{#if compact}
			<button type="button" class="av-btn" aria-label={m.app_account_menu()} {...props}>
				<Avatar name={me.name} seed={me.id} image={me.image} size={32} />
			</button>
		{:else}
			<button type="button" class="acct-chip" aria-label={m.app_account_menu()} {...props}>
				<Avatar name={me.name} seed={me.id} image={me.image} />
				<span class="who">
					<span class="name"
						><b>{me.name}</b>{#if page.data.moderator}<ModeratorBadge />{/if}</span
					>
					<span class="handle">@{me.handle}</span>
				</span>
				<span class="chev"><Icon name="more" size="sm" /></span>
			</button>
		{/if}
	{/snippet}
	{#snippet children(close)}
		<a class="menu-item" role="menuitem" href={profile_href(me.handle)} onclick={close}>
			<Icon name="user" />{m.app_profile()}
		</a>
		<!-- Phones have no room for Bookmarks in the tab bar; wider screens show it in the side nav. -->
		<a class="menu-item phone-only" role="menuitem" href={bookmarks_href()} onclick={close}>
			<Icon name="bookmark" />{m.app_bookmarks()}
		</a>
		<a class="menu-item" role="menuitem" href={settings_href()} onclick={close}>
			<Icon name="settings" />{m.settings_title()}
		</a>
		{#if page.data.moderator}
			<a class="menu-item" role="menuitem" href={mod_href()} onclick={close}>
				<Icon name="shield" />{m.mod_title()}
			</a>
		{/if}
		<form method="post" action="{home_href()}?/signOut" onsubmit={sign_out}>
			<button class="menu-item" role="menuitem">
				<Icon name="logout" />{m.app_log_out({ handle: me.handle })}
			</button>
		</form>
	{/snippet}
</Menu>

<style>
	.av-btn {
		display: grid;
		border-radius: 50%;
	}
	.acct-chip {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		padding: 10px;
		border-radius: 999px;
		text-align: left;
		transition: background-color 0.15s;
	}
	.acct-chip:hover {
		background: var(--bg-2);
	}
	.who {
		min-width: 0;
		flex: 1;
		line-height: 1.25;
	}
	.name {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.name b,
	.handle {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	/* A long name gives way to the badge, not the other way round. */
	.name b {
		min-width: 0;
	}
	.handle {
		color: var(--text-2);
		font-size: 14px;
	}
	.chev {
		color: var(--text-2);
		display: grid;
	}
	@media (min-width: 701px) {
		/* Outranks Menu's `.pop .menu-item { display: flex }`. */
		a.menu-item.phone-only {
			display: none;
		}
	}
	@media (max-width: 1180px) {
		.acct-chip {
			width: auto;
			padding: 6px;
		}
		.who,
		.chev {
			display: none;
		}
	}
</style>
