<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import type { Author } from '#lib/posts/types'
	import { edit_profile_href } from '#lib/profiles/links'
	import SettingRow from '#lib/settings/SettingRow.svelte'
	import Avatar from '#lib/ui/Avatar.svelte'
	import Icon from '#lib/ui/Icon.svelte'
	import { home_href } from '../../(public)/links'
	import { sign_out } from '../sign-out'

	let { me, email }: { me: Author & { handle: string }; email?: string } = $props()
</script>

<a class="row who" href={edit_profile_href()}>
	<Avatar name={me.name} seed={me.id} image={me.image} size={44} />
	<span class="text">
		<b>{me.name}</b>
		<span class="handle">@{me.handle}</span>
	</span>
	<span class="edit">{m.profile_edit()}<Icon name="chev-right" size="sm" /></span>
</a>
{#if email}
	<div class="row">
		<SettingRow icon="mail" label={m.settings_email()} sub={email} />
	</div>
{/if}
<form method="post" action="{home_href()}?/signOut" onsubmit={sign_out}>
	<button class="row danger">
		<SettingRow icon="logout" label={m.app_log_out({ handle: me.handle })} />
	</button>
</form>

<style>
	.row {
		display: flex;
		align-items: center;
		gap: 14px;
		width: 100%;
		min-height: 52px;
		padding: 10px 16px;
		text-align: left;
	}
	a.row,
	button.row {
		transition: background-color 0.15s;
	}
	a.row:hover,
	button.row:hover {
		background: var(--bg-2);
	}
	.text {
		flex: 1;
		min-width: 0;
		line-height: 1.3;
	}
	.text b,
	.handle {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.handle {
		color: var(--text-2);
		font-size: 14px;
	}
	.edit {
		display: flex;
		align-items: center;
		gap: 2px;
		color: var(--text-2);
		font-size: 14px;
		font-weight: 600;
	}
	.danger,
	.danger :global(.ico) {
		color: var(--danger);
	}
</style>
