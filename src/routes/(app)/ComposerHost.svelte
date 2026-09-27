<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import Composer from '#lib/posts/Composer.svelte'
	import { composer, edited_posts } from '#lib/posts/state.svelte'
	import type { Author } from '#lib/posts/types'
	import ConfirmDialog from '#lib/ui/ConfirmDialog.svelte'
	import Modal from '#lib/ui/Modal.svelte'

	let { me }: { me: Author } = $props()

	let draft = $state('')
	let asking = $state(false)

	/** Whether closing would throw away typing. An unchanged edit is not a draft. */
	function has_draft() {
		const task = composer.task
		if (!task) return false
		const text = draft.trim()
		if (task.kind === 'edit') return text !== (edited_posts.get(task.post.id) ?? task.post.body)
		return text !== ''
	}

	function close() {
		asking = false
		draft = ''
		composer.close()
	}

	function request_close() {
		if (has_draft()) asking = true
		else close()
	}
</script>

{#if composer.task}
	{@const task = composer.task}
	{#key task}
		<Modal
			label={task.kind === 'edit' ? m.post_edit() : m.app_new_post()}
			onrequestclose={request_close}
		>
			<Composer
				{task}
				{me}
				variant="modal"
				bind:text={draft}
				onclose={request_close}
				ondone={close}
			/>
		</Modal>
	{/key}
{/if}

{#if asking}
	<ConfirmDialog
		title={m.discard_title()}
		body={m.discard_body()}
		cta={m.discard_cta()}
		onconfirm={close}
		oncancel={() => (asking = false)}
	/>
{/if}
