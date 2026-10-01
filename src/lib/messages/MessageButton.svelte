<script lang="ts">
	import { goto } from '$app/navigation'
	import { m } from '#lib/paraglide/messages.js'
	import Icon from '#lib/ui/Icon.svelte'
	import { toast } from '#lib/ui/toasts.svelte'
	import { conversation_href } from './links'
	import { start_conversation } from './messages.remote'

	let { user_id, handle }: { user_id: string; handle: string } = $props()

	let pending = $state(false)

	async function open() {
		if (pending) return
		pending = true
		try {
			const id = await start_conversation({ user_ids: [user_id] })
			await goto(conversation_href(id))
		} catch {
			toast.show(m.toast_error())
		} finally {
			pending = false
		}
	}
</script>

<button
	type="button"
	class="icon-btn"
	aria-label={m.dm_message_user({ handle })}
	aria-disabled={pending}
	onclick={open}
>
	<Icon name="mail" size="sm" />
</button>

<style>
	.icon-btn {
		border: 1px solid var(--line-2);
	}
</style>
