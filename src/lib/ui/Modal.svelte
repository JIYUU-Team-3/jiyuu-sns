<script lang="ts">
	import { onMount, type Snippet } from 'svelte'

	let {
		size = 'default',
		label,
		onrequestclose,
		children,
	}: {
		/** 600px, or the 380px confirm size placed 20vh from the top. */
		size?: 'default' | 'sm'
		label: string
		/** Escape or a click on the scrim. The owner decides whether that really closes it. */
		onrequestclose: () => void
		children: Snippet
	} = $props()

	let dialog: HTMLDialogElement

	onMount(() => {
		// Mounting is opening: the owner shows a modal with `{#if}`. Focus goes back to whatever
		// opened it, such as the post's ⋯ button, when it unmounts.
		const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
		dialog.showModal()
		// showModal() focuses the first control (usually Close); content can name a better start.
		dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true })
		return () => opener?.focus({ preventScroll: true })
	})
</script>

<dialog
	bind:this={dialog}
	class:sm={size === 'sm'}
	aria-label={label}
	oncancel={(event) => {
		event.preventDefault()
		onrequestclose()
	}}
	onclick={(event) => {
		if (event.target === dialog) onrequestclose()
	}}
>
	<div class="modal" class:sm={size === 'sm'}>{@render children()}</div>
</dialog>

<style>
	/* The dialog is the scrim; the card inside it is the modal surface. */
	dialog {
		position: fixed;
		inset: 0;
		width: 100%;
		height: 100%;
		max-width: none;
		max-height: none;
		margin: 0;
		border: 0;
		padding: 5vh 16px;
		background: var(--backdrop);
		color: inherit;
		overflow-y: auto;
		overscroll-behavior: contain;
	}
	dialog[open] {
		display: flex;
		align-items: flex-start;
		justify-content: center;
		animation: fade 0.18s ease-out;
	}
	dialog::backdrop {
		background: transparent;
	}
	:global(html:has(dialog[open])) {
		overflow: hidden;
	}
	.modal {
		width: 600px;
		max-width: 100%;
		background: var(--bg);
		border-radius: var(--r-card);
		box-shadow: var(--shadow-modal);
		animation: rise 0.28s var(--ease-out);
		position: relative;
		margin-bottom: 5vh;
	}
	.modal.sm {
		width: 380px;
		margin-top: 20vh;
	}
	@keyframes fade {
		from {
			opacity: 0;
		}
	}
	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(10px) scale(0.985);
		}
	}
	@media (max-width: 700px) {
		dialog {
			padding: 0;
		}
		dialog[open]:not(.sm) {
			align-items: stretch;
		}
		.modal:not(.sm) {
			width: 100%;
			min-height: 100dvh;
			border-radius: 0;
			margin: 0;
		}
		.modal.sm {
			margin: auto 16px;
		}
	}
</style>
