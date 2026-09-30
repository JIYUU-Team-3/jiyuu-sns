<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import Composer from '#lib/posts/Composer.svelte'
	import { Draft } from '#lib/posts/composer/draft.svelte'
	import { composer, post_content, type ComposerTask } from '#lib/posts/state.svelte'
	import type { Author } from '#lib/posts/types'
	import ConfirmDialog from '#lib/ui/ConfirmDialog.svelte'
	import Modal from '#lib/ui/Modal.svelte'

	let { me }: { me: Author } = $props()

	/** A fresh draft each time the modal opens; an edit starts from what the post shows. */
	function new_draft(task: ComposerTask) {
		return task.kind === 'edit' ? Draft.editing(post_content(task.post)) : new Draft()
	}

	const draft = $derived(composer.task && new_draft(composer.task))
	let asking = $state(false)

	/** Whether closing would throw away work. An unchanged edit is not a draft. */
	function has_draft() {
		const task = composer.task
		if (!task || !draft) return false
		if (task.kind === 'edit') return !draft.matches(post_content(task.post))
		return draft.dirty
	}

	/** Close after publishing: the draft's uploads now belong to the post. */
	function close() {
		asking = false
		composer.close()
	}

	/** Close without publishing, deleting any photos uploaded for this draft. */
	function discard() {
		draft?.discard()
		close()
	}

	function request_close() {
		if (has_draft()) asking = true
		else discard()
	}
</script>

{#if composer.task && draft}
	{@const task = composer.task}
	{#key task}
		<Modal
			label={task.kind === 'edit' ? m.post_edit() : m.app_new_post()}
			onrequestclose={request_close}
		>
			<Composer {task} {me} {draft} variant="modal" onclose={request_close} ondone={close} />
		</Modal>
	{/key}
{/if}

{#if asking}
	<ConfirmDialog
		title={m.discard_title()}
		body={m.discard_body()}
		cta={m.discard_cta()}
		onconfirm={discard}
		oncancel={() => (asking = false)}
	/>
{/if}
