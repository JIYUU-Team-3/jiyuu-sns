<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import TextMorph from '#lib/ui/TextMorph.svelte'

	let {
		handle,
		followed,
		requested,
		follows_you = false,
		pending,
		small = false,
		ontoggle,
	}: {
		handle: string
		followed: boolean
		requested: boolean
		follows_you?: boolean
		pending: boolean
		small?: boolean
		/** Asked to follow, unfollow or withdraw a request; the caller saves it. */
		ontoggle: () => void
	} = $props()

	let hovered = $state(false)
	let focused = $state(false)
	/** Off right after a toggle, so a fresh follow reads "Following" until the pointer or focus leaves. */
	let armed = $state(true)

	const active = $derived(followed || requested)
	const warn = $derived(followed && armed && (hovered || focused))
	const label = $derived.by(() => {
		if (requested) return m.follow_requested()
		if (!followed) return follows_you ? m.follow_follow_back() : m.follow_follow()
		return warn ? m.follow_unfollow() : m.follow_following()
	})
	// Following and Unfollow share one width, so hovering never resizes the button.
	const reserve = $derived(followed ? [m.follow_following(), m.follow_unfollow()] : [])

	function toggle() {
		if (pending) return
		armed = false
		ontoggle()
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
	class={['btn', 'follow', small && 'sm', active ? 'btn-outline' : 'btn-ink', warn && 'warn']}
	aria-label={requested
		? m.follow_cancel_label({ handle })
		: followed
			? m.follow_unfollow_label({ handle })
			: m.follow_follow_label({ handle })}
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
		flex: none;
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
