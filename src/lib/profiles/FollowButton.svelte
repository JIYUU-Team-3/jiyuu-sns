<script lang="ts">
	import { refusal_message } from '#lib/moderation/refusals'
	import { m } from '#lib/paraglide/messages.js'
	import { toast } from '#lib/ui/toasts.svelte'
	import FollowControl from './FollowControl.svelte'
	import { get_profile, set_follow } from './profiles.remote'
	import type { ProfileView } from './types'

	let { profile }: { profile: ProfileView } = $props()

	let pending = $state(false)

	async function toggle() {
		const on = !(profile.followed || profile.requested)
		pending = true
		try {
			await set_follow({ handle: profile.handle, on }).updates(
				get_profile(profile.handle).withOverride((current) =>
					current.requested || (on && current.private)
						? { ...current, requested: on }
						: {
								...current,
								followed: on,
								followers: current.followers + (on ? 1 : -1),
							},
				),
			)
		} catch (cause) {
			toast.show(refusal_message(cause, m.toast_error))
		} finally {
			pending = false
		}
	}
</script>

<FollowControl
	handle={profile.handle}
	followed={profile.followed}
	requested={profile.requested}
	follows_you={profile.follows_you}
	{pending}
	ontoggle={toggle}
/>
