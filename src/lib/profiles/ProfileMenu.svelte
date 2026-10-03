<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import { block, mute } from '#lib/safety/actions'
	import ReportDialog from '#lib/safety/ReportDialog.svelte'
	import ConfirmDialog from '#lib/ui/ConfirmDialog.svelte'
	import Icon from '#lib/ui/Icon.svelte'
	import Menu from '#lib/ui/Menu.svelte'
	import type { ProfileView } from './types'

	let {
		profile,
		plain = false,
	}: {
		profile: ProfileView
		/** No outline, as in the phone's top bar. */
		plain?: boolean
	} = $props()

	let blocking = $state(false)
	let reporting = $state(false)

	const handle = $derived(profile.handle)
	const person = $derived({ id: profile.id, handle: profile.handle })
</script>

<Menu label={m.profile_more()} compact>
	{#snippet trigger(props)}
		<button
			type="button"
			class="icon-btn more"
			class:plain
			aria-label={m.profile_more()}
			{...props}
		>
			<Icon name="more" size={plain ? 'md' : 'sm'} />
		</button>
	{/snippet}
	{#snippet children(close)}
		<button
			type="button"
			class="menu-item"
			role="menuitem"
			onclick={() => {
				close()
				void mute(person, !profile.muted, false)
			}}
		>
			<Icon name="volume-x" />{profile.muted
				? m.safety_unmute({ handle })
				: m.safety_mute({ handle })}
		</button>
		<button
			type="button"
			class="menu-item"
			role="menuitem"
			onclick={() => {
				close()
				if (profile.blocked) void block(person, false, false)
				else blocking = true
			}}
		>
			<Icon name="ban" />{profile.blocked
				? m.safety_unblock({ handle })
				: m.safety_block({ handle })}
		</button>
		<div class="menu-sep" role="separator"></div>
		<button
			type="button"
			class="menu-item danger"
			role="menuitem"
			onclick={() => {
				close()
				reporting = true
			}}
		>
			<Icon name="flag" />{m.safety_report_account({ handle })}
		</button>
	{/snippet}
</Menu>

{#if blocking}
	<ConfirmDialog
		title={m.safety_block_title({ handle })}
		body={m.safety_block_body()}
		cta={m.safety_block_cta()}
		onconfirm={() => {
			blocking = false
			void block(person, true, false)
		}}
		oncancel={() => (blocking = false)}
	/>
{/if}

{#if reporting}
	<ReportDialog {handle} onclose={() => (reporting = false)} />
{/if}

<style>
	.more:not(.plain) {
		border: 1px solid var(--line-2);
	}
</style>
