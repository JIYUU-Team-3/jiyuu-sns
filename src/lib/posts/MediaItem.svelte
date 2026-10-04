<script lang="ts" module>
	import { m } from '#lib/paraglide/messages.js'
	import type { Media } from './types'

	/** Where an item sits in its post, as a screen reader hears it: "Video 2 of 3". */
	export function position_label(item: Media, n: number, total: number) {
		return item.kind === 'video'
			? m.post_video_position({ n, total })
			: m.post_photo_label({ n, total })
	}
</script>

<script lang="ts">
	import PostVideo from './PostVideo.svelte'

	let {
		item,
		label,
		eager = false,
		onopen,
	}: {
		item: Media
		/** What a photo or video without a description is announced as. */
		label: string
		eager?: boolean
		/** Given where a click on a photo opens it full screen. A video keeps its own tap. */
		onopen?: () => void
	} = $props()
</script>

{#snippet photo()}
	<!-- A GIF comes from GIPHY's CDN, which needn't learn which page it was seen on. -->
	<img
		src={item.url}
		referrerpolicy="no-referrer"
		alt={item.alt || (item.kind === 'gif' ? m.post_gif_label() : label)}
		width={item.width}
		height={item.height}
		loading={eager ? 'eager' : 'lazy'}
		decoding="async"
	/>
{/snippet}

<div class="m">
	{#if item.kind === 'video'}
		<PostVideo {item} {label} />
	{:else if onopen}
		<button type="button" class="open" onclick={onopen}>{@render photo()}</button>
	{:else}
		{@render photo()}
	{/if}
	{#if item.kind === 'gif'}<span class="gif-badge" aria-hidden="true">GIF</span>{/if}
</div>

<style>
	.m {
		position: relative;
		width: 100%;
		height: 100%;
		background: var(--img-fallback);
	}
	.open {
		display: block;
		width: 100%;
		height: 100%;
		cursor: zoom-in;
	}
	.open:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}
	img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.gif-badge {
		position: absolute;
		left: 10px;
		bottom: 10px;
		background: rgba(0, 0, 0, 0.72);
		color: #fff;
		font-size: 12px;
		font-weight: 800;
		padding: 2px 6px;
		border-radius: 4px;
		letter-spacing: 0.04em;
	}
</style>
