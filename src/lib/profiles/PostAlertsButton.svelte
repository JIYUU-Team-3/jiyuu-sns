<script lang="ts">
	import { refusal_message } from '#lib/moderation/refusals'
	import { m } from '#lib/paraglide/messages.js'
	import Icon from '#lib/ui/Icon.svelte'
	import { toast } from '#lib/ui/toasts.svelte'
	import { get_profile, set_post_alerts } from './profiles.remote'
	import type { ProfileView } from './types'

	let { profile }: { profile: ProfileView } = $props()

	let pending = $state(false)

	async function toggle() {
		if (pending) return
		const on = !profile.alerts
		pending = true
		try {
			await set_post_alerts({ handle: profile.handle, on }).updates(
				get_profile(profile.handle).withOverride((current) => ({ ...current, alerts: on })),
			)
			toast.show(
				on
					? m.post_alerts_on_toast({ name: profile.name })
					: m.post_alerts_off_toast({ name: profile.name }),
			)
		} catch (cause) {
			toast.show(refusal_message(cause, m.toast_error))
		} finally {
			pending = false
		}
	}
</script>

<button
	type="button"
	class="icon-btn"
	class:on={profile.alerts}
	aria-label={m.post_alerts_label({ handle: profile.handle })}
	aria-pressed={profile.alerts}
	aria-disabled={pending}
	onclick={toggle}
>
	<Icon name="bell" size="sm" filled={profile.alerts} />
</button>

<style>
	.icon-btn {
		border: 1px solid var(--line-2);
	}
	.on {
		color: var(--accent);
	}
</style>
