<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import type { UserView } from '#lib/search/types'
	import ConfirmDialog from '#lib/ui/ConfirmDialog.svelte'
	import Icon from '#lib/ui/Icon.svelte'
	import Menu from '#lib/ui/Menu.svelte'
	import { toast } from '#lib/ui/toasts.svelte'
	import { remove_follower } from './profiles.remote'

	let {
		user,
		removed,
	}: {
		user: UserView
		/** Accounts taken off your followers here; this one joins it at once. */
		removed: Set<string>
	} = $props()

	let confirming = $state(false)

	async function remove() {
		confirming = false
		removed.add(user.id)
		try {
			await remove_follower({ handle: user.handle })
			toast.show(m.follows_removed({ handle: user.handle }))
		} catch {
			removed.delete(user.id)
			toast.show(m.toast_error())
		}
	}
</script>

<Menu label={m.follows_more_label({ handle: user.handle })}>
	{#snippet trigger(props)}
		<button
			type="button"
			class="icon-btn"
			aria-label={m.follows_more_label({ handle: user.handle })}
			{...props}
		>
			<Icon name="more" size="sm" />
		</button>
	{/snippet}
	{#snippet children(close)}
		<button
			type="button"
			class="menu-item danger"
			role="menuitem"
			onclick={() => {
				close()
				confirming = true
			}}
		>
			<Icon name="user-x" />{m.follows_remove()}
		</button>
	{/snippet}
</Menu>

{#if confirming}
	<ConfirmDialog
		title={m.follows_remove_title({ handle: user.handle })}
		body={m.follows_remove_body()}
		cta={m.follows_remove_cta()}
		onconfirm={remove}
		oncancel={() => (confirming = false)}
	/>
{/if}
