<script lang="ts">
	import { onMount, type Snippet } from 'svelte'
	import { m } from '#lib/paraglide/messages.js'
	import Icon from '#lib/ui/Icon.svelte'

	let {
		label,
		q = $bindable(''),
		children,
		footer,
	}: {
		/** The search box's placeholder and label. */
		label: string
		q?: string
		/** The results for `q`; rendered in a boundary with its own loading and error states. */
		children: Snippet
		footer?: Snippet
	} = $props()

	let input: HTMLInputElement

	// The reader just asked to search, so the box takes focus when the panel opens.
	onMount(() => input.focus())
</script>

<div class="picker">
	<label class="search">
		<Icon name="search" size="sm" />
		<input
			type="search"
			placeholder={label}
			aria-label={label}
			autocomplete="off"
			bind:this={input}
			bind:value={q}
		/>
	</label>
	<svelte:boundary>
		{@render children()}
		{#snippet pending()}
			<p class="note" role="status">{m.composer_picker_loading()}</p>
		{/snippet}
		{#snippet failed()}
			<p class="note">{m.composer_picker_error()}</p>
		{/snippet}
	</svelte:boundary>
	{@render footer?.()}
</div>

<style>
	.picker {
		border: 1px solid var(--line);
		border-radius: var(--r-md);
		margin: 8px 0;
		overflow: hidden;
	}
	.search {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 10px;
		height: 38px;
		padding: 0 12px;
		border-radius: 999px;
		background: var(--bg-2);
		color: var(--text-2);
	}
	.search:focus-within {
		box-shadow: 0 0 0 1px var(--accent);
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
	.note {
		margin: 0;
		padding: 12px 14px 16px;
		color: var(--text-2);
		font-size: 14px;
	}
</style>
