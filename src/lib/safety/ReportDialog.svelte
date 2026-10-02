<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import TextField from '#lib/profiles/form/TextField.svelte'
	import Icon from '#lib/ui/Icon.svelte'
	import Modal from '#lib/ui/Modal.svelte'
	import { toast } from '#lib/ui/toasts.svelte'
	import { REPORT_NOTE_MAX, REPORT_REASONS, type ReportReason } from './rules'
	import { report } from './safety.remote'

	let { handle, post_id, onclose }: { handle: string; post_id?: string; onclose: () => void } =
		$props()

	const LABELS: Record<ReportReason, () => string> = {
		spam: m.report_spam,
		harassment: m.report_harassment,
		hate: m.report_hate,
		violence: m.report_violence,
		sexual: m.report_sexual,
		self_harm: m.report_self_harm,
		other: m.report_other,
	}

	let reason = $state<ReportReason>()
	let note = $state('')
	let busy = $state(false)

	async function send(event: SubmitEvent) {
		event.preventDefault()
		if (!reason || busy) return
		busy = true
		try {
			await report({ handle, post_id, reason, note })
			toast.show(m.toast_reported())
			onclose()
		} catch {
			toast.show(m.toast_error())
		} finally {
			busy = false
		}
	}
</script>

<Modal label={m.report_title()} onrequestclose={onclose}>
	<form onsubmit={send}>
		<div class="head">
			<button type="button" class="icon-btn" aria-label={m.dialog_cancel()} onclick={onclose}>
				<Icon name="x" />
			</button>
			<h2 id="report-title">{m.report_title()}</h2>
			<button class="btn btn-primary sm" disabled={!reason || busy}>{m.report_send()}</button>
		</div>
		<fieldset aria-labelledby="report-title">
			{#each REPORT_REASONS as value (value)}
				<label class="reason">
					<input type="radio" name="reason" {value} bind:group={reason} />
					{LABELS[value]()}
				</label>
			{/each}
		</fieldset>
		<div class="body">
			<TextField
				name="note"
				label={m.report_note()}
				bind:value={note}
				max={REPORT_NOTE_MAX}
				counted
				multiline
				rows={3}
			/>
		</div>
	</form>
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
	fieldset {
		border: 0;
		margin: 0;
		padding: 0;
	}
	.reason {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		cursor: pointer;
		transition: background-color 0.15s;
	}
	.reason:hover {
		background: var(--bg-2);
	}
	.reason input {
		accent-color: var(--accent-fill);
		width: 18px;
		height: 18px;
		margin: 0;
	}
	.body {
		padding: 16px 16px 0;
	}
</style>
