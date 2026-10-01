<script lang="ts">
	import { refusal_message } from '#lib/moderation/refusals'
	import { m } from '#lib/paraglide/messages.js'
	import TextMorph from '#lib/ui/TextMorph.svelte'
	import { toast } from '#lib/ui/toasts.svelte'
	import { get_profile, set_follow } from './profiles.remote'
	import type { ProfileView } from './types'

	let { profile }: { profile: ProfileView } = $props()

	let pending = $state(false)
	let hovered = $state(false)
	let focused = $state(false)
	/** Off right after a toggle, so a fresh follow reads "Following" until the pointer or focus leaves. */
	let armed = $state(true)

	const warn = $derived(profile.followed && armed && (hovered || focused))
	const label = $derived.by(() => {
		if (!profile.followed) return profile.follows_you ? m.follow_follow_back() : m.follow_follow()
		return warn ? m.follow_unfollow() : m.follow_following()
	})
	// Following and Unfollow share one width, so hovering never resizes the button.
	const reserve = $derived(profile.followed ? [m.follow_following(), m.follow_unfollow()] : [])

	async function toggle() {
		if (pending) return
		const on = !profile.followed
		armed = false
		pending = true
		try {
			await set_follow({ handle: profile.handle, on }).updates(
				get_profile(profile.handle).withOverride((current) => ({
					...current,
					followed: on,
					followers: current.followers + (on ? 1 : -1),
				})),
			)
		} catch (cause) {
			toast.show(refusal_message(cause, m.toast_error))
		} finally {
			pending = false
		}
	}

	function enter(event: PointerEvent) {
		if (event.pointerType !== 'touch') hovered = true
	}

	function leave(event: PointerEvent) {
		if (event.pointerType === 'touch') return
		hovered = false
		armed = true
	}

	function focus(event: FocusEvent) {
		focused = (event.currentTarget as HTMLElement).matches(':focus-visible')
	}

	function blur() {
		focused = false
		armed = true
	}
</script>

<!-- Not `disabled` while pending: a disabled button misses the pointer leaving, which re-arms it. -->
<button
	type="button"
	class={['btn', 'follow', profile.followed ? 'btn-outline' : 'btn-ink', warn && 'warn']}
	aria-label={profile.followed
		? m.follow_unfollow_label({ handle: profile.handle })
		: m.follow_follow_label({ handle: profile.handle })}
	aria-disabled={pending}
	onclick={toggle}
	onpointerenter={enter}
	onpointerleave={leave}
	onfocus={focus}
	onblur={blur}
>
	<TextMorph text={label} {reserve} />
</button>

<style>
	/* Ink has no border of its own; a clear one keeps its size equal to the outlined state. */
	.follow {
		border: 1px solid transparent;
	}
	.follow.btn-outline {
		border-color: var(--line-2);
	}
	.follow.warn {
		border-color: var(--danger);
		color: var(--danger);
		background: var(--danger-soft);
	}
</style>
