<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import { push } from '#lib/notifications/push.svelte'
	import ConfirmDialog from '#lib/ui/ConfirmDialog.svelte'
	import { home_href } from '../(public)/links'

	let { handle, oncancel }: { handle: string; oncancel: () => void } = $props()

	let form: HTMLFormElement
	let leaving = false

	/** Forget this device's push subscription first, without letting a slow push service hold it up. */
	async function log_out() {
		if (leaving) return
		leaving = true
		await Promise.race([
			push.forget().catch(() => {}),
			new Promise((done) => setTimeout(done, 2000)),
		])
		form.submit()
	}
</script>

<form method="post" action="{home_href()}?/signOut" bind:this={form} hidden></form>
<ConfirmDialog
	title={m.app_log_out_confirm()}
	cta={m.app_log_out({ handle })}
	onconfirm={log_out}
	{oncancel}
/>
