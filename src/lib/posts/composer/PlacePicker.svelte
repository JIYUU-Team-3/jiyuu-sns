<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import { debounced } from './debounce.svelte'
	import PickerPanel from './PickerPanel.svelte'
	import PlaceResults from './PlaceResults.svelte'

	let { onpick }: { onpick: (name: string) => void } = $props()

	let q = $state('')
	const search = debounced(() => q.trim(), 350)
</script>

<PickerPanel label={m.composer_place_search()} bind:q>
	<PlaceResults q={search.current} {onpick} />
	{#snippet footer()}
		<p class="credit">© OpenStreetMap</p>
	{/snippet}
</PickerPanel>

<style>
	.credit {
		margin: 0;
		padding: 0 12px 8px;
		text-align: right;
		font-size: 11px;
		color: var(--text-3);
	}
</style>
