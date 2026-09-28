<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import Modal from './Modal.svelte'

	let {
		title,
		body,
		cta,
		onconfirm,
		oncancel,
	}: {
		title: string
		body: string
		/** The destructive action's label, e.g. "Delete". */
		cta: string
		onconfirm: () => void
		oncancel: () => void
	} = $props()
</script>

<Modal size="sm" label={title} onrequestclose={oncancel}>
	<div class="confirm">
		<h2>{title}</h2>
		<p>{body}</p>
		<button type="button" class="btn btn-danger" onclick={onconfirm}>{cta}</button>
		<button type="button" class="btn btn-outline" onclick={oncancel}>{m.dialog_cancel()}</button>
	</div>
</Modal>

<style>
	.confirm {
		padding: 28px 28px 24px;
	}
	h2 {
		font-size: 20px;
		font-weight: 800;
		margin: 0 0 8px;
		letter-spacing: -0.01em;
	}
	p {
		color: var(--text-2);
		margin: 0 0 22px;
	}
	.btn {
		width: 100%;
		height: 44px;
		margin-top: 10px;
	}
</style>
