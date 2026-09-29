<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import type { Media } from './types'

	let {
		item,
		label,
		eager = false,
	}: {
		item: Media
		/** What a photo without a description is announced as. */
		label: string
		eager?: boolean
	} = $props()
</script>

<div class="m">
	<img
		src={item.url}
		alt={item.alt || (item.kind === 'gif' ? m.post_gif_label() : label)}
		width={item.width}
		height={item.height}
		loading={eager ? 'eager' : 'lazy'}
		decoding="async"
	/>
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
