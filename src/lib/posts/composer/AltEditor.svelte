<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import TextField from '#lib/profiles/form/TextField.svelte'
	import Icon from '#lib/ui/Icon.svelte'
	import Modal from '#lib/ui/Modal.svelte'
	import { ALT_MAX } from '../rules'

	let {
		src,
		video = false,
		alt,
		onapply,
		oncancel,
	}: {
		/** The photo, GIF or video being described. */
		src: string
		video?: boolean
		alt: string
		onapply: (alt: string) => void
		oncancel: () => void
	} = $props()

	const HINT_ID = 'alt-text-hint'

	// The editor opens for one item and closes before another, so reading it once is right.
	// svelte-ignore state_referenced_locally
	let value = $state(alt)

	const apply = () => onapply(value.trim())

	/** Keys stay here: the composer behind would otherwise post on ⌘/Ctrl+Enter. */
	function onkeydown(event: KeyboardEvent) {
		event.stopPropagation()
		if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
			event.preventDefault()
			apply()
		}
	}
</script>

<Modal label={m.composer_alt_title()} onrequestclose={oncancel}>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div {onkeydown}>
		<div class="head">
			<button type="button" class="icon-btn" aria-label={m.dialog_cancel()} onclick={oncancel}>
				<Icon name="x" />
			</button>
			<h2>{m.composer_alt_title()}</h2>
			<button type="button" class="btn btn-primary sm" onclick={apply}
				>{m.composer_alt_save()}</button
			>
		</div>
		<div class="stage">
			{#if video}
				<video {src} muted playsinline controls preload="metadata"></video>
			{:else}
				<img {src} alt="" />
			{/if}
		</div>
		<div class="body">
			<TextField
				name="alt"
				label={m.composer_alt_label()}
				bind:value
				max={ALT_MAX}
				counted
				multiline
				rows={3}
				autofocus
				describedby={HINT_ID}
			/>
			<p id={HINT_ID} class="hint">{m.composer_alt_hint()}</p>
		</div>
	</div>
</Modal>

<style>
	.head {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px 12px;
		min-height: 53px;
	}
	h2 {
		flex: 1;
		font-size: 20px;
		font-weight: 800;
		margin: 0;
		letter-spacing: -0.01em;
	}
	.stage {
		display: grid;
		place-items: center;
		padding: 16px;
		background: var(--bg-3);
	}
	img,
	video {
		max-width: 100%;
		max-height: 40vh;
		border-radius: 8px;
	}
	.body {
		padding: 16px 16px 0;
	}
	.hint {
		font-size: 13px;
		color: var(--text-2);
		margin: -8px 0 0;
		padding-bottom: 16px;
	}
</style>
