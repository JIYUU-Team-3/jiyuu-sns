<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import { debounced } from '#lib/posts/composer/debounce.svelte'
	import { find_places } from '#lib/posts/pickers.remote'
	import type { Place } from '#lib/posts/types'
	import Icon from '#lib/ui/Icon.svelte'
	import { LOCATION_MAX } from '../details'
	import TextField from './TextField.svelte'

	/** How many places to suggest under the field. */
	const SHOWN = 5

	let { value = $bindable('') }: { value?: string } = $props()

	let focused = $state(false)
	/**
	 * The text a suggestion was picked as, so picking one doesn't search for it again. Not state:
	 * setting it mustn't rerun the search with the text from before the pick.
	 */
	let picked: string | undefined
	let places = $state<Place[]>([])
	const q = debounced(() => value.trim(), 350)

	// Free text is fine as it is; places from OpenStreetMap are only suggestions.
	$effect(() => {
		const text = q.current
		if (text.length < 2 || text === picked) {
			places = []
			return
		}
		let stale = false
		find_places(text).then(
			(found) => !stale && (places = found.slice(0, SHOWN)),
			() => !stale && (places = []),
		)
		return () => {
			stale = true
		}
	})

	/** The place's full name when it fits, else only its first part, e.g. `Phnom Penh Municipality`. */
	const fit = (name: string) =>
		name.length <= LOCATION_MAX ? name : name.split(',')[0].trim().slice(0, LOCATION_MAX)

	function pick(place: Place) {
		value = picked = fit(place.name)
		places = []
	}
</script>

<div class="loc" onfocusin={() => (focused = true)} onfocusout={() => (focused = false)}>
	<TextField
		name="location"
		label={m.profile_location()}
		placeholder={m.profile_location_placeholder()}
		max={LOCATION_MAX}
		counted
		autocomplete="off"
		bind:value
	/>
	{#if focused && places.length}
		<ul class="list" aria-label={m.profile_location_suggestions()}>
			{#each places as place (place.name)}
				<li>
					<!-- Picked on pointer down, before the field's blur hides the list. -->
					<button
						type="button"
						onpointerdown={(event) => {
							event.preventDefault()
							pick(place)
						}}
						onclick={() => pick(place)}
					>
						<Icon name="pin" />
						<span>
							<b>{place.name}</b>
							{#if place.detail}<span class="sub">{place.detail}</span>{/if}
						</span>
					</button>
				</li>
			{/each}
			<li class="credit">© OpenStreetMap</li>
		</ul>
	{/if}
</div>

<style>
	.loc {
		position: relative;
	}
	.list {
		position: absolute;
		z-index: 20;
		top: calc(100% - 12px);
		left: 0;
		right: 0;
		list-style: none;
		margin: 0;
		padding: 6px 0 0;
		background: var(--bg-elev);
		border: 1px solid var(--line);
		border-radius: var(--r-md);
		box-shadow: var(--shadow-pop);
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
	button:hover,
	button:focus-visible {
		background: var(--bg-2);
		outline: none;
	}
	.sub {
		display: block;
		font-size: 13px;
		color: var(--text-2);
	}
	.credit {
		padding: 2px 12px 6px;
		text-align: right;
		font-size: 11px;
		color: var(--text-3);
	}
</style>
