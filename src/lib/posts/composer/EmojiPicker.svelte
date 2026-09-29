<script lang="ts">
	import { onMount } from 'svelte'
	import { getLocale } from '#lib/paraglide/runtime'
	import { m } from '#lib/paraglide/messages.js'

	let { onpick }: { onpick: (emoji: string) => void } = $props()

	const DATA = 'https://cdn.jsdelivr.net/npm/emoji-picker-element-data@^1'

	/** Japanese gets Japanese names and search; Khmer has no emoji data, so it uses English. */
	const japanese = getLocale() === 'ja'

	let status = $state<'loading' | 'ready' | 'failed'>('loading')
	let picker = $state<HTMLElement & { i18n?: unknown }>()

	// A custom element: it only exists in the browser, so it's defined after mount.
	onMount(() => {
		Promise.all([
			import('emoji-picker-element'),
			japanese ? import('emoji-picker-element/i18n/ja') : undefined,
		])
			.then(([, ja]) => {
				status = 'ready'
				// The element takes its translations as a property, set once it exists.
				if (ja) queueMicrotask(() => picker && (picker.i18n = ja.default))
			})
			.catch(() => (status = 'failed'))
	})

	function onemojiclick(event: Event) {
		const unicode = (event as CustomEvent<{ unicode?: string }>).detail.unicode
		if (unicode) onpick(unicode)
	}
</script>

<div class="emoji">
	{#if status === 'ready'}
		<svelte:element
			this={"emoji-picker"}
			bind:this={picker}
			locale={japanese ? 'ja' : 'en'}
			data-source={japanese ? `${DATA}/ja/cldr/data.json` : `${DATA}/en/emojibase/data.json`}
			{...{ 'onemoji-click': onemojiclick }}
		></svelte:element>
	{:else if status === 'failed'}
		<p class="note">{m.composer_picker_error()}</p>
	{/if}
</div>

<style>
	.emoji {
		margin: 8px 0;
		border: 1px solid var(--line);
		border-radius: var(--r-md);
		overflow: hidden;
		min-height: 60px;
	}
	/* The picker is themed through its own custom properties, from the app's tokens. */
	.emoji :global(emoji-picker) {
		width: 100%;
		--background: var(--bg-elev);
		--border-color: var(--line);
		--border-size: 0;
		--indicator-color: var(--accent);
		--input-border-color: var(--line-2);
		--input-font-color: var(--text);
		--input-placeholder-color: var(--text-3);
		--outline-color: var(--accent);
		--category-font-color: var(--text-2);
		--button-active-background: var(--bg-3);
		--button-hover-background: var(--bg-2);
	}
	.note {
		margin: 0;
		padding: 12px 14px;
		color: var(--text-2);
		font-size: 14px;
	}
</style>
