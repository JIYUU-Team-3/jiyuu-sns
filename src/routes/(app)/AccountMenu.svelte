<script lang="ts">
	import { push } from '#lib/notifications/push.svelte'
	import { m } from '#lib/paraglide/messages.js'
	import type { Author } from '#lib/posts/types'
	import { profile_href } from '#lib/profiles/links'
	import Avatar from '#lib/ui/Avatar.svelte'
	import Icon from '#lib/ui/Icon.svelte'
	import Menu from '#lib/ui/Menu.svelte'
	import { home_href } from '../(public)/links'

	let { me, compact = false }: { me: Author & { handle: string }; compact?: boolean } = $props()

	/**
	 * Stop pushes to this browser first, so whoever signs in next doesn't get this account's
	 * notifications. Signing out still works if that fails or takes too long.
	 */
	async function onsubmit(event: SubmitEvent) {
		const form = event.currentTarget as HTMLFormElement
		event.preventDefault()
		await Promise.race([
			push.forget().catch(() => {}),
			new Promise((done) => setTimeout(done, 2000)),
		])
		form.submit()
	}
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
				<span class="who"><b>{me.name}</b><span>@{me.handle}</span></span>
				<span class="chev"><Icon name="more" size="sm" /></span>
			</button>
		{/if}
	{/snippet}
	{#snippet children(close)}
		<a class="menu-item" role="menuitem" href={profile_href(me.handle)} onclick={close}>
			<Icon name="user" />{m.app_profile()}
		</a>
		<form method="post" action="{home_href()}?/signOut" {onsubmit}>
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
	.who b,
	.who span {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.who span {
		color: var(--text-2);
		font-size: 14px;
	}
	.chev {
		color: var(--text-2);
		display: grid;
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
