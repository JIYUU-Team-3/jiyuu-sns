<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import Icon from '#lib/ui/Icon.svelte'
	import LinkCard from '../LinkCard.svelte'
	import { get_link_preview } from '../posts.remote'
	import { debounced } from './debounce.svelte'
	import type { Draft } from './draft.svelte'

	/** The card the post will show for its link, with a button to take it off. */
	let { draft }: { draft: Draft } = $props()

	// Waits until the link has stopped changing, so typing one asks for it once.
	const link = debounced(() => (draft.shows_link ? draft.link : undefined), 600)
</script>

{#if link.current && draft.shows_link}
	<svelte:boundary>
		{@const preview = await get_link_preview(link.current)}
		{#if preview}
			<div class="preview">
				<LinkCard link={preview} />
				<button
					type="button"
					class="remove"
					aria-label={m.composer_remove_link_preview()}
					onclick={() => (draft.link_off = draft.link)}
				>
					<Icon name="x" size="xs" />
				</button>
			</div>
		{/if}
		{#snippet pending()}{/snippet}
		<!-- A page that can't be read just has no card; posting still works. -->
		{#snippet failed()}{/snippet}
	</svelte:boundary>
{/if}

<style>
	.preview {
		position: relative;
		margin-bottom: 6px;
	}
	.remove {
		position: absolute;
		top: 18px;
		right: 6px;
		display: grid;
		place-items: center;
		width: 26px;
		height: 26px;
		border-radius: 999px;
		background: rgba(0, 0, 0, 0.6);
		color: #fff;
	}
	.remove:hover {
		background: rgba(0, 0, 0, 0.75);
	}
</style>
