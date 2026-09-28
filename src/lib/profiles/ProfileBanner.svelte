<script lang="ts">
	import type { Snippet } from 'svelte'

	let {
		src,
		alt = '',
		children,
	}: {
		/** The header image; undefined shows the plain fill. */
		src?: string
		alt?: string
		/** Drawn over the banner, such as the edit page's camera button. */
		children?: Snippet
	} = $props()

	/** Set when the image fails to load, so the plain fill shows instead. */
	let broken = $state(false)
</script>

<div class="banner">
	{#if src && !broken}
		<img {src} {alt} onerror={() => (broken = true)} />
	{/if}
	{@render children?.()}
</div>

<style>
	.banner {
		position: relative;
		aspect-ratio: 3 / 1;
		background: var(--img-fallback);
		overflow: hidden;
	}
	img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
</style>
