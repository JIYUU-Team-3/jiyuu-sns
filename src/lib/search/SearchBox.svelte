<script lang="ts">
	import { goto } from '$app/navigation'
	import { m } from '#lib/paraglide/messages.js'
	import Icon from '#lib/ui/Icon.svelte'
	import { search_href } from './links'

	let { value = '' }: { value?: string } = $props()

	// Follows the page's query, but the reader can type over it.
	let q = $derived(value)

	function onsubmit(event: SubmitEvent) {
		event.preventDefault()
		const text = q.trim()
		if (text) goto(search_href(text))
	}
</script>

<form class="search" role="search" {onsubmit}>
	<Icon name="search" size="sm" />
	<input
		type="search"
		name="q"
		bind:value={q}
		placeholder={m.search_placeholder()}
		aria-label={m.search_label()}
		autocomplete="off"
		maxlength="100"
	/>
</form>

<style>
	.search {
		display: flex;
		align-items: center;
		gap: 10px;
		height: 42px;
		padding: 0 16px;
		border-radius: 999px;
		background: var(--bg-3);
		border: 1px solid transparent;
		color: var(--text-2);
	}
	.search:focus-within {
		background: var(--bg);
		border-color: var(--accent);
		color: var(--accent);
	}
	input {
		flex: 1;
		min-width: 0;
		border: 0;
		outline: 0;
		background: none;
		color: var(--text);
		font: inherit;
	}
	input::placeholder {
		color: var(--text-3);
	}
</style>
