<script lang="ts">
	import { onMount } from 'svelte'
	import { m } from '#lib/paraglide/messages.js'
	import { split_at_limit } from '../rules'
	import { text_segments } from '../text'

	let {
		value = $bindable(''),
		placeholder,
		size,
		autofocus = false,
		name,
		onkeydown,
	}: {
		value?: string
		placeholder: string
		/** `lg` for the modal, `md` inline on Home, `sm` in the reply box. */
		size: 'lg' | 'md' | 'sm'
		autofocus?: boolean
		name?: string
		onkeydown?: (event: KeyboardEvent) => void
	} = $props()

	let textarea: HTMLTextAreaElement

	const parts = $derived(split_at_limit(value))
	const kept = $derived(text_segments(parts[0]))

	/** Put text at the caret (or over the selection), as typing it would. */
	export function insert(text: string) {
		textarea.focus()
		textarea.setRangeText(text, textarea.selectionStart, textarea.selectionEnd, 'end')
		// `setRangeText` fires no input event, so tell `bind:value` and the counter.
		textarea.dispatchEvent(new Event('input', { bubbles: true }))
	}

	/** Grow with the text; the textarea never scrolls on its own. */
	$effect(() => {
		void value
		textarea.style.height = 'auto'
		textarea.style.height = `${textarea.scrollHeight}px`
	})

	onMount(() => {
		// An edit starts with the caret at the end.
		if (autofocus) textarea.setSelectionRange(value.length, value.length)
	})
</script>

<div class="editor {size}">
	<!--
		The textarea's own text is transparent; this mirror under it paints the text, with hashtags
		in the accent colour and anything past the limit highlighted, like X.
	-->
	<!-- prettier-ignore -->
	<div class="mirror" aria-hidden="true">{#each kept as segment, i (i)}{#if segment.tag}<span class="tag">{segment.text}</span>{:else}{segment.text}{/if}{/each}<mark>{parts[1]}</mark>&#8203;</div>
	<textarea
		{name}
		rows="1"
		{placeholder}
		aria-label={m.composer_label()}
		bind:value
		bind:this={textarea}
		data-autofocus={autofocus ? '' : undefined}
		{onkeydown}></textarea>
</div>

<style>
	.editor {
		position: relative;
		font-size: 20px;
		line-height: 1.35;
	}
	.editor.sm {
		font-size: 17px;
	}
	.mirror,
	textarea {
		font: inherit;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		padding: 0;
		margin: 0;
		border: 0;
	}
	.mirror {
		position: absolute;
		inset: 0;
		color: var(--text);
		pointer-events: none;
	}
	.tag {
		color: var(--accent-text);
	}
	mark {
		color: inherit;
		background: var(--danger-soft);
		border-radius: 2px;
	}
	textarea {
		position: relative;
		display: block;
		width: 100%;
		min-height: 1.35em;
		background: none;
		color: transparent;
		caret-color: var(--text);
		outline: 0;
		resize: none;
		overflow: hidden;
	}
	.lg textarea {
		min-height: 72px;
	}
	textarea::placeholder {
		color: var(--text-3);
	}
	textarea::selection {
		color: transparent;
		background: var(--accent-soft-2);
	}
	/* The whole composer is the field; the global focus ring would box the textarea alone. */
	textarea:focus-visible {
		outline: none;
	}
</style>
