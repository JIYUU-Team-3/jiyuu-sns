<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import Icon from '#lib/ui/Icon.svelte'
	import type { Draft } from './draft.svelte'
	import EmojiPicker from './EmojiPicker.svelte'
	import GifPicker from './GifPicker.svelte'
	import MediaTray from './MediaTray.svelte'
	import PlacePicker from './PlacePicker.svelte'
	import PollBuilder from './PollBuilder.svelte'

	/** Everything under the text: the tray, the poll, the place, and whichever picker is open. */
	let { draft, oninsert }: { draft: Draft; oninsert: (text: string) => void } = $props()
</script>

<MediaTray {draft} />
{#if draft.media.length && !draft.editing}
	<label class="sensitive">
		<input type="checkbox" bind:checked={draft.sensitive} />
		{m.composer_sensitive()}
	</label>
{/if}
{#if draft.poll}<PollBuilder {draft} poll={draft.poll} />{/if}
{#if draft.location}
	<span class="place">
		<Icon name="pin" size="xs" />{draft.location}
		<button
			type="button"
			aria-label={m.composer_remove_location()}
			onclick={() => (draft.location = undefined)}
		>
			<Icon name="x" size="xs" />
		</button>
	</span>
{/if}

{#if draft.panel === 'gif'}
	<GifPicker onpick={(gif) => draft.add_gif(gif)} />
{:else if draft.panel === 'place'}
	<PlacePicker
		onpick={(name) => {
			draft.location = name
			draft.panel = undefined
		}}
	/>
{:else if draft.panel === 'emoji'}
	<EmojiPicker onpick={oninsert} />
{/if}

<style>
	.sensitive {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 6px 0;
		font-size: 14px;
		color: var(--text-2);
	}
	.place {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		max-width: 100%;
		color: var(--accent-text);
		font-size: 14px;
		font-weight: 600;
		margin: 6px 0;
		padding: 4px 8px 4px 6px;
		border-radius: 999px;
		background: var(--accent-soft);
	}
	.place button {
		display: grid;
		place-items: center;
	}
</style>
