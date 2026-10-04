<script lang="ts">
	import Carousel from './Carousel.svelte'
	import MediaItem, { position_label } from './MediaItem.svelte'
	import { viewer } from './state.svelte'
	import type { Media, PostView } from './types'

	let {
		media,
		post,
		focus = false,
		onswipe,
	}: {
		media: Media[]
		/** The post they belong to. Given where a click on a photo opens the full-screen viewer. */
		post?: PostView
		focus?: boolean
		onswipe?: (swiped: boolean, top: number) => void
	} = $props()

	const [first] = $derived(media)
	const onopen = $derived(post && ((index: number) => viewer.open(post, index)))
</script>

{#if media.length > 1}
	<Carousel {media} {focus} {onswipe} {onopen} />
{:else if first}
	<div class="single" class:focus style:--r={first.width / first.height}>
		<MediaItem
			item={first}
			label={position_label(first, 1, 1)}
			eager
			onopen={onopen && (() => onopen(0))}
		/>
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
	/* On a phone the post's own page gives it the whole column, as tall as its shape makes it. */
	@media (max-width: 700px) {
		.single.focus {
			width: 100%;
		}
	}
</style>
