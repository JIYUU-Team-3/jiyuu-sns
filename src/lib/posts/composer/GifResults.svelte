<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import { find_gifs } from '../pickers.remote'
	import type { Gif } from '../types'

	let { q, onpick }: { q: string; onpick: (gif: Gif) => void } = $props()

	const result = $derived(await find_gifs(q))
</script>

{#if !result.enabled}
	<p class="note">{m.composer_gif_unavailable()}</p>
{:else if !result.gifs.length}
	<p class="note">{m.composer_gif_empty()}</p>
{:else}
	<div class="grid">
		{#each result.gifs as gif (gif.id)}
			<button
				type="button"
				aria-label={m.composer_gif_choose({ title: gif.title || 'GIF' })}
				onclick={() => onpick(gif)}
			>
				<img src={gif.preview.url} alt="" loading="lazy" />
			</button>
		{/each}
	</div>
{/if}

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 4px;
		padding: 0 10px 10px;
		max-height: 240px;
		overflow-y: auto;
	}
	/* A square from padding, not aspect-ratio: Safari sizes the rows of a scrolling grid before
	   it applies a button's aspect-ratio, so the rows came out short and the GIFs overlapped. */
	button {
		position: relative;
		display: block;
		width: 100%;
		padding: 0 0 100%;
		border-radius: 8px;
		overflow: hidden;
		background: var(--img-fallback);
	}
	img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		transition: transform 0.3s var(--ease-out);
	}
	button:hover img {
		transform: scale(1.05);
	}
	.note {
		margin: 0;
		padding: 12px 14px 16px;
		color: var(--text-2);
		font-size: 14px;
	}
</style>
