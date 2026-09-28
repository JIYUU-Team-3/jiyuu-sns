<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import { toast } from '#lib/ui/toasts.svelte'
	import { get_profile, set_follow } from './profiles.remote'
	import type { ProfileView } from './types'

	let { profile }: { profile: ProfileView } = $props()

	let pending = $state(false)

	async function toggle() {
		const on = !profile.followed
		pending = true
		try {
			await set_follow({ handle: profile.handle, on }).updates(
				get_profile(profile.handle).withOverride((current) => ({
					...current,
					followed: on,
					followers: current.followers + (on ? 1 : -1),
				})),
			)
		} catch {
			toast.show(m.toast_error())
		} finally {
			pending = false
		}
	}
</script>

{#if profile.followed}
	<button
		type="button"
		class="btn btn-outline following"
		aria-label={m.follow_unfollow_label({ handle: profile.handle })}
		disabled={pending}
		onclick={toggle}
	>
		<span class="idle">{m.follow_following()}</span>
		<span class="hover">{m.follow_unfollow()}</span>
	</button>
{:else}
	<button
		type="button"
		class="btn btn-ink"
		aria-label={m.follow_follow_label({ handle: profile.handle })}
		disabled={pending}
		onclick={toggle}
	>
		{profile.follows_you ? m.follow_follow_back() : m.follow_follow()}
	</button>
{/if}

<style>
	.following {
		display: inline-grid;
	}
	.following > span {
		grid-area: 1 / 1;
	}
	.hover {
		visibility: hidden;
	}
	.following:hover,
	.following:focus-visible {
		border-color: var(--danger);
		color: var(--danger);
		background: var(--danger-soft);
	}
	.following:hover .idle,
	.following:focus-visible .idle {
		visibility: hidden;
	}
	.following:hover .hover,
	.following:focus-visible .hover {
		visibility: visible;
	}
</style>
