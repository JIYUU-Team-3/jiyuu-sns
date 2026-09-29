<script lang="ts">
	import { untrack } from 'svelte'
	import { m } from '#lib/paraglide/messages.js'
	import Icon from '#lib/ui/Icon.svelte'
	import { carousel_size, SLIDE_GAP } from './carousel-size'
	import MediaItem, { position_label } from './MediaItem.svelte'
	import type { Media } from './types'

	let {
		media,
		focus = false,
		onswipe,
	}: {
		media: Media[]
		focus?: boolean
		/** Whether the track has left its start, with the carousel's top edge on screen. */
		onswipe?: (swiped: boolean, top: number) => void
	} = $props()

	/** The track's padding either side of the text column: the gutter bleed, then the edge. */
	const INSET = { card: 68 + 16, focus: 16 + 16 }

	let width = $state(0)
	// A pixel of slack, so rounding never tips a fitted pair into scrolling.
	const column = $derived(width && width - INSET[focus ? 'focus' : 'card'] - 1)
	// One height for every slide; each keeps its own shape, so nothing is cropped.
	const size = $derived(
		carousel_size(
			media.map((item) => item.width / item.height),
			column,
		),
	)

	let car: HTMLDivElement
	let track: HTMLDivElement
	let at_start = $state(true)
	let at_end = $state(false)
	/** What `onswipe` last heard, so it only hears changes. Plain: nothing renders from it. */
	let swiped = false

	function report(now: boolean) {
		if (now === swiped) return
		swiped = now
		onswipe?.(now, car.getBoundingClientRect().top)
	}

	function update_edges() {
		at_start = track.scrollLeft < 4
		at_end = track.scrollLeft + track.clientWidth > track.scrollWidth - 4
		report(!at_start)
	}

	/** Scroll by one slide; snapping lines the next one up with the text column. */
	function step(direction: 1 | -1) {
		const slide = track.querySelector<HTMLElement>('.slide')
		track.scrollBy({
			left: direction * ((slide?.offsetWidth ?? 0) + SLIDE_GAP),
			behavior: 'smooth',
		})
	}

	/** How long the track must sit still before a swipe counts as settled, in milliseconds. */
	const SETTLE = 120
	let settle: ReturnType<typeof setTimeout> | undefined

	/**
	 * Hold every update until the swipe settles: iOS Safari re-snaps a track whose page restyles
	 * mid-swipe, throwing it back to the first slide. Leaving the start is the one exception, so
	 * the avatar tucks as the swipe begins; that only rescales it, which needs no layout.
	 */
	function onscroll() {
		if (track.scrollLeft >= 4) report(true)
		clearTimeout(settle)
		settle = setTimeout(update_edges, SETTLE)
	}

	// Untracked: `onswipe` reads the card's tuck, and a rerun mid-swipe would restyle the track.
	$effect(() => {
		untrack(update_edges)
		return () => clearTimeout(settle)
	})
</script>

<div
	class="car"
	class:focus
	class:fits={size.fits}
	style:--h="{size.height}px"
	style:--gap="{SLIDE_GAP}px"
	bind:this={car}
	bind:clientWidth={width}
>
	<div
		class="track"
		role="group"
		aria-label={m.post_photos_label({ count: media.length })}
		bind:this={track}
		{onscroll}
	>
		<!-- Keyed by position too: posts from before duplicates were refused may hold one GIF twice. -->
		{#each media as item, i (`${i}:${item.url}`)}
			{@const position = position_label(item, i + 1, media.length)}
			<!-- A description replaces "Photo 2 of 3" as the alt, so the slide says where it is. -->
			<div
				class="slide"
				role={item.alt ? 'group' : undefined}
				aria-label={item.alt ? position : undefined}
				style:--r={item.width / item.height}
			>
				<MediaItem {item} label={position} eager={i === 0} />
			</div>
		{/each}
	</div>
	<button
		type="button"
		class="nav prev"
		class:off={at_start}
		aria-label={m.post_photo_prev()}
		onclick={() => step(-1)}
	>
		<Icon name="chev-left" size="sm" />
	</button>
	<button
		type="button"
		class="nav next"
		class:off={at_end}
		aria-label={m.post_photo_next()}
		onclick={() => step(1)}
	>
		<Icon name="chev-right" size="sm" />
	</button>
</div>

<style>
	/* Bleeds into the avatar gutter; the first slide lines up with the text. */
	.car {
		position: relative;
		margin: 12px -16px 0 -68px;
	}
	.track {
		display: flex;
		gap: var(--gap);
		overflow-x: auto;
		scroll-snap-type: x mandatory;
		scroll-padding-inline: 68px 16px;
		padding: 0 16px 0 68px;
		scrollbar-width: none;
		overscroll-behavior-x: contain;
		align-items: center;
	}
	.track::-webkit-scrollbar {
		display: none;
	}
	/*
	 * Every slide gets the same height, never more than 70% of the screen so a phone still sees
	 * the post around it, and the width its ratio asks for.
	 */
	.slide {
		flex: none;
		box-sizing: border-box;
		height: min(var(--h), 70svh);
		width: calc(min(var(--h), 70svh) * var(--r));
		scroll-snap-align: start;
		border-radius: var(--r-card);
		overflow: hidden;
		border: 1px solid var(--line);
	}
	.nav {
		position: absolute;
		top: 50%;
		translate: 0 -50%;
		width: 34px;
		height: 34px;
		border-radius: 50%;
		display: grid;
		place-items: center;
		background: rgba(15, 20, 25, 0.72);
		color: #fff;
		backdrop-filter: blur(6px);
		opacity: 0;
		transition: opacity 0.15s;
	}
	.prev {
		left: 76px;
	}
	.next {
		right: 24px;
	}
	.car:hover .nav,
	.nav:focus-visible {
		opacity: 1;
	}
	/* Nothing to scroll to when the photos fit. */
	.fits .nav {
		display: none;
	}
	/*
	 * On the buttons, not the carousel: restyling the track's parent mid-swipe makes iOS Safari
	 * re-snap the track, throwing the swipe back to the first slide.
	 */
	.car .nav.off {
		opacity: 0;
		pointer-events: none;
	}
	@media (hover: none) {
		.nav {
			display: none;
		}
	}

	.focus {
		margin: 12px -16px 0;
	}
	.focus .track {
		padding: 0 16px;
		scroll-padding-inline: 16px;
	}
	.focus .prev {
		left: 24px;
	}
</style>
