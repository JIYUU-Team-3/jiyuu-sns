<script lang="ts">
	import Carousel from './Carousel.svelte'
	import MediaItem, { position_label } from './MediaItem.svelte'
	import type { Media } from './types'

	let {
		media,
		focus = false,
		onswipe,
	}: {
		media: Media[]
		focus?: boolean
		onswipe?: (swiped: boolean, top: number) => void
	} = $props()

	const [first] = $derived(media)
</script>

{#if media.length > 1}
	<Carousel {media} {focus} {onswipe} />
{:else if first}
	<div class="single" style:--r={first.width / first.height}>
		<MediaItem item={first} label={position_label(first, 1, 1)} eager />
	</div>
{/if}

<style>
	/*
	 * One photo keeps its own shape, uncropped: full width, or narrower when a tall photo would
	 * otherwise pass 600px (or 70% of the screen) high, matching the carousel.
	 */
	.single {
		margin-top: 12px;
		width: min(100%, calc(min(600px, 70svh) * var(--r)));
		aspect-ratio: var(--r);
		border-radius: var(--r-card);
		overflow: hidden;
		border: 1px solid var(--line);
	}
</style>
