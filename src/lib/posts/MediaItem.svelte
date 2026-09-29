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
	}: {
		item: Media
		/** What a photo or video without a description is announced as. */
		label: string
		eager?: boolean
	} = $props()
</script>

<div class="m">
	{#if item.kind === 'video'}
		<PostVideo {item} {label} />
	{:else}
		<img
			src={item.url}
			alt={item.alt || (item.kind === 'gif' ? m.post_gif_label() : label)}
			width={item.width}
			height={item.height}
			loading={eager ? 'eager' : 'lazy'}
			decoding="async"
		/>
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
