<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import type { Gif } from '../types'
	import { debounced } from './debounce.svelte'
	import GifResults from './GifResults.svelte'
	import PickerPanel from './PickerPanel.svelte'

	let { onpick }: { onpick: (gif: Gif) => void } = $props()

	let q = $state('')
	const search = debounced(() => q.trim())
</script>

<PickerPanel label={m.composer_gif_search()} bind:q>
	<GifResults q={search.current} {onpick} />
	{#snippet footer()}
		<!-- GIPHY's terms ask for this wherever their results show. -->
		<p class="credit">{m.composer_gif_credit()}</p>
	{/snippet}
</PickerPanel>

<style>
	.credit {
		margin: 0;
		padding: 0 12px 8px;
		text-align: right;
		font-size: 11px;
		font-weight: 700;
		color: var(--text-3);
	}
</style>
