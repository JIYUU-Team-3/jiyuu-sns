<script lang="ts">
	import { IMAGE_ACCEPT } from '#lib/media'
	import { m } from '#lib/paraglide/messages.js'
	import Icon from '#lib/ui/Icon.svelte'
	import { toast } from '#lib/ui/toasts.svelte'
	import { MEDIA_MAX } from '../rules'
	import type { Draft, PickResult } from './draft.svelte'

	let { draft }: { draft: Draft } = $props()

	let file_input: HTMLInputElement

	/** One toast for whatever was left out, most important reason first. */
	function report({ skipped, over_limit }: PickResult) {
		if (over_limit) toast.show(m.composer_media_limit({ count: MEDIA_MAX }))
		else if (skipped.includes('size')) toast.show(m.composer_media_too_big())
		else if (skipped.includes('type')) toast.show(m.composer_media_type())
	}

	function onchange() {
		report(draft.add_files([...(file_input.files ?? [])]))
		// Let the same file be picked again after it's removed.
		file_input.value = ''
	}
</script>

<div class="tools">
	<input bind:this={file_input} type="file" accept={IMAGE_ACCEPT} multiple hidden {onchange} />
	<button
		type="button"
		class="icon-btn"
		aria-label={m.composer_add_photos()}
		title={m.composer_add_photos()}
		disabled={draft.media_room <= 0}
		onclick={() => file_input.click()}
	>
		<Icon name="image" />
	</button>
	<button
		type="button"
		class="icon-btn"
		aria-label={m.composer_add_gif()}
		title={m.composer_add_gif()}
		aria-expanded={draft.panel === 'gif'}
		disabled={draft.media_room <= 0}
		onclick={() => draft.toggle('gif')}
	>
		<Icon name="gif" />
	</button>
	<button
		type="button"
		class="icon-btn"
		aria-label={m.composer_add_poll()}
		title={m.composer_add_poll()}
		disabled={!draft.can_poll}
		onclick={() => draft.add_poll()}
	>
		<Icon name="poll" />
	</button>
	<button
		type="button"
		class="icon-btn"
		aria-label={m.composer_add_emoji()}
		title={m.composer_add_emoji()}
		aria-expanded={draft.panel === 'emoji'}
		onclick={() => draft.toggle('emoji')}
	>
		<Icon name="smile" />
	</button>
	<button
		type="button"
		class="icon-btn"
		aria-label={m.composer_add_location()}
		title={m.composer_add_location()}
		aria-expanded={draft.panel === 'place'}
		onclick={() => draft.toggle('place')}
	>
		<Icon name="pin" />
	</button>
</div>

<style>
	.tools {
		display: flex;
		margin-left: -8px;
	}
	.icon-btn {
		color: var(--accent-text);
	}
	.icon-btn:hover:not(:disabled),
	.icon-btn[aria-expanded='true'] {
		background: var(--accent-soft);
	}
</style>
