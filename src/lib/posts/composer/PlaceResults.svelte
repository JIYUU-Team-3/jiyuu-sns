<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import Icon from '#lib/ui/Icon.svelte'
	import { find_places } from '../pickers.remote'

	let { q, onpick }: { q: string; onpick: (name: string) => void } = $props()

	const places = $derived(await find_places(q))
</script>

{#if q.length < 2}
	<p class="note">{m.composer_place_hint()}</p>
{:else if !places.length}
	<p class="note">{m.composer_place_empty()}</p>
{:else}
	<ul class="list">
		{#each places as place (place.name)}
			<li>
				<button type="button" onclick={() => onpick(place.name)}>
					<Icon name="pin" />
					<span>
						<b>{place.name}</b>
						{#if place.detail}<span class="sub">{place.detail}</span>{/if}
					</span>
				</button>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.list {
		list-style: none;
		margin: 0;
		padding: 0 0 6px;
		max-height: 260px;
		overflow-y: auto;
	}
	button {
		display: flex;
		gap: 12px;
		align-items: center;
		width: 100%;
		padding: 10px 14px;
		text-align: left;
		transition: background-color 0.12s;
	}
	button:hover {
		background: var(--bg-2);
	}
	.sub {
		display: block;
		font-size: 13px;
		color: var(--text-2);
	}
	.note {
		margin: 0;
		padding: 4px 14px 16px;
		color: var(--text-2);
		font-size: 14px;
	}
</style>
