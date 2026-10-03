<script lang="ts">
	import { tick, type Snippet } from 'svelte'
	import { m } from '#lib/paraglide/messages.js'
	import Icon from './Icon.svelte'
	import { register_reload } from './reload.svelte'
	import { toast } from './toasts.svelte'

	let {
		onrefresh,
		children,
	}: {
		/** Reloads what's below; the spinner stays until it settles. */
		onrefresh: () => Promise<unknown>
		children: Snippet
	} = $props()

	/** How far the content must be pulled for a release to refresh. */
	const TRIGGER = 64
	/** Where the content waits while the refresh runs. */
	const HOLD = 52
	/** The content eases toward this and never passes it, however far the finger goes. */
	const MAX = 150
	/** The content moves this much per pixel at the start of the pull; it slows from there. */
	const RESIST = 0.7
	/** Finger travel before the gesture picks an axis. */
	const SLOP = 10
	/** The spinner shows at least this long, so a fast refresh still reads as one. */
	const MIN_SPIN = 400

	let pull = $state(0)
	let dragging = $state(false)
	let refreshing = $state(false)

	const offset = $derived(refreshing ? HOLD : pull)
	const progress = $derived(Math.min(1, offset / TRIGGER))

	/** Typing fields keep their own drags (selecting text, the inline composer). */
	const editable = (target: EventTarget | null) =>
		target instanceof Element &&
		!!target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')

	/** Rubber band: follows the finger at first, then tightens smoothly instead of hitting a wall. */
	const rubber = (travel: number) => MAX * (1 - Math.exp(-Math.max(0, travel) * (RESIST / MAX)))

	async function refresh() {
		if (refreshing) return
		refreshing = true
		// Svelte holds a state change in the same batch as pending async work until that work
		// settles, so let the spinner commit before the reload starts or it never shows.
		await tick()
		try {
			await Promise.all([onrefresh(), new Promise((done) => setTimeout(done, MIN_SPIN))])
		} catch {
			toast.show(m.list_error())
		} finally {
			refreshing = false
		}
	}

	// A tap on the current page's nav item or tab reloads from the top, spinner and all.
	$effect(() =>
		register_reload(() => {
			scrollTo({ top: 0, behavior: 'smooth' })
			void refresh()
		}),
	)

	/**
	 * Attachment for the wrapper. Svelte's touch attributes are passive, and this one must be able
	 * to stop the page scrolling (and iOS bouncing) once the pull starts.
	 */
	const gesture = (node: HTMLElement) => {
		let start: { x: number; y: number } | undefined
		let down = false

		const ontouchstart = (event: TouchEvent) => {
			// A second finger mid-pull calls it off.
			start = undefined
			down = false
			dragging = false
			pull = 0
			if (refreshing || event.touches.length !== 1 || scrollY > 0 || editable(event.target)) return
			start = { x: event.touches[0].clientX, y: event.touches[0].clientY }
		}

		const ontouchmove = (event: TouchEvent) => {
			if (!start) return
			const dx = event.touches[0].clientX - start.x
			const dy = event.touches[0].clientY - start.y
			if (!down) {
				if (Math.hypot(dx, dy) < SLOP) return
				// Sideways (a carousel) or upward (scrolling on) isn't a pull.
				if (dy <= Math.abs(dx) || scrollY > 0) return void (start = undefined)
				down = true
			}
			event.preventDefault()
			dragging = true
			pull = rubber(dy)
		}

		const oncancel = () => {
			start = undefined
			dragging = false
			pull = 0
		}

		const ontouchend = () => {
			if (pull >= TRIGGER) void refresh()
			oncancel()
		}

		node.addEventListener('touchstart', ontouchstart, { passive: true })
		node.addEventListener('touchmove', ontouchmove, { passive: false })
		node.addEventListener('touchend', ontouchend)
		node.addEventListener('touchcancel', oncancel)
		return () => {
			node.removeEventListener('touchstart', ontouchstart)
			node.removeEventListener('touchmove', ontouchmove)
			node.removeEventListener('touchend', ontouchend)
			node.removeEventListener('touchcancel', oncancel)
		}
	}
</script>

<div class="ptr" class:dragging {@attach gesture}>
	<div
		class="indicator"
		class:armed={pull >= TRIGGER}
		class:refreshing
		style:height="{offset}px"
		style:opacity={progress}
	>
		{#if refreshing}
			<span class="badge spin" role="status" aria-label={m.ptr_refreshing()}
				><Icon name="refresh" /></span
			>
		{:else}
			<span class="badge" style:rotate="{progress * 270}deg" style:scale={0.5 + progress * 0.5}
				><Icon name="refresh" /></span
			>
		{/if}
	</div>
	<!-- No transform at rest, so nothing inside gets a new containing block for good. -->
	<div class="content" style:transform={offset ? `translateY(${offset}px)` : undefined}>
		{@render children()}
	</div>
</div>

<style>
	/* The browser's own pull-to-refresh would reload the whole page on top of this one. */
	:global(html:has(.ptr)) {
		overscroll-behavior-y: contain;
	}
	.ptr {
		position: relative;
	}
	.indicator {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		display: grid;
		place-items: center;
		overflow: hidden;
		color: var(--text-3);
		pointer-events: none;
		transition:
			height 0.35s var(--ease-out),
			opacity 0.35s var(--ease-out),
			color 0.15s;
	}
	.indicator.armed,
	.indicator.refreshing {
		color: var(--accent-text);
	}
	.content {
		transition: transform 0.45s cubic-bezier(0.34, 1.4, 0.64, 1);
	}
	.dragging .indicator,
	.dragging .content {
		transition: color 0.15s;
	}
	.badge {
		display: grid;
		transition:
			rotate 0.35s var(--ease-out),
			scale 0.35s var(--ease-out);
	}
	.dragging .badge {
		transition: none;
	}
	/* Picks up from where the pull left the arrow (270deg) so the hand-off doesn't jump. */
	.spin {
		rotate: 270deg;
		scale: 1;
		animation:
			pop 0.3s var(--ease-out),
			spin 0.8s linear infinite;
	}
	@keyframes pop {
		from {
			scale: 0.7;
		}
	}
	@keyframes spin {
		to {
			rotate: 630deg;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		/* The spinner is the only sign a refresh is running, so it keeps turning; only the pop goes. */
		.spin {
			animation: spin 1.6s linear infinite;
		}
	}
</style>
