<script lang="ts">
	import { flip } from 'svelte/animate'
	import { m } from '#lib/paraglide/messages.js'
	import { file_size } from '#lib/files'
	import Icon from '#lib/ui/Icon.svelte'
	import AltEditor from './AltEditor.svelte'
	import { croppable, type Draft, type DraftMedia } from './draft.svelte'
	import PhotoCropper from './PhotoCropper.svelte'
	import { Sortable } from './sortable.svelte'

	let { draft }: { draft: Draft } = $props()

	/** The photo open in the cropper. */
	let cropping = $state<DraftMedia>()
	/** The photo, GIF or video open in the description editor. */
	let describing = $state<DraftMedia>()

	const sortable = new Sortable(
		() => draft.media.map((item) => item.key),
		(from, to) => draft.move_media(from, to),
	)
</script>

{#if draft.media.length}
	<ul class="tray" aria-label={m.composer_media_label()}>
		{#each draft.media as item, i (item.key)}
			{@const dragging = sortable.dragging === item.key}
			<!-- Each tile is a drag handle and, focused, takes arrow keys to move. -->
			<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
			<li
				class="thumb"
				class:failed={item.state === 'failed'}
				class:dragging
				data-key={item.key}
				tabindex="0"
				aria-label={m.composer_media_item({ n: i + 1, total: draft.media.length })}
				style:translate={dragging ? `${sortable.offset.x}px ${sortable.offset.y}px` : undefined}
				animate:flip={{ duration: dragging ? 0 : 200 }}
				onpointerdown={(event) => sortable.start(event, item.key)}
				onpointermove={(event) => sortable.drag(event)}
				onpointerup={() => sortable.end()}
				onpointercancel={() => sortable.end()}
				onkeydown={(event) => sortable.key(event, i)}
			>
				{#if item.kind === 'file'}
					<div class="file-preview">
						<Icon name="plus" />
						<strong>{item.name}</strong><span>{file_size(item.size ?? 0)}</span>
					</div>
				{:else if item.kind === 'video'}
					<!-- The first frame as a still; it plays once posted. -->
					{#if item.preview}
						<video src={item.preview} muted playsinline preload="metadata"></video>
					{/if}
					<span class="badge"><Icon name="play" size="xs" /></span>
				{:else}
					<img src={item.preview} alt="" draggable="false" />
				{/if}
				{#if item.kind === 'gif'}<span class="badge">GIF</span>{/if}
				{#if item.state === 'uploading'}
					<span class="status" role="status" aria-label={m.composer_uploading()}
						><span class="spinner"></span></span
					>
				{:else if item.state === 'failed'}
					<span class="status failed-note">{m.composer_upload_failed()}</span>
				{/if}
				{#if croppable(item)}
					<button
						type="button"
						class="corner crop"
						aria-label={m.composer_crop_photo({ n: i + 1 })}
						onclick={() => (cropping = item)}
					>
						<Icon name="crop" size="sm" />
					</button>
				{/if}
				{#if item.kind !== 'file' && item.state !== 'failed'}
					{@const described = !!item.alt.trim()}
					<button
						type="button"
						class="alt"
						class:described
						aria-label={described
							? m.composer_alt_edit({ n: i + 1 })
							: m.composer_alt_add({ n: i + 1 })}
						onclick={() => (describing = item)}
					>
						{#if described}<Icon name="check" size="sm" />{/if}ALT
					</button>
				{/if}
				<button
					type="button"
					class="corner remove"
					aria-label={m.composer_remove_media()}
					onclick={() => draft.remove_media(item.key)}
				>
					<Icon name="x" size="sm" />
				</button>
			</li>
		{/each}
	</ul>
{/if}

{#if describing}
	{@const item = describing}
	<AltEditor
		src={item.preview}
		video={item.kind === 'video'}
		alt={item.alt}
		onapply={(alt) => {
			draft.describe(item.key, alt)
			describing = undefined
		}}
		oncancel={() => (describing = undefined)}
	/>
{/if}

{#if cropping?.original}
	{@const item = cropping}
	<PhotoCropper
		file={cropping.original}
		start={cropping.crop}
		onapply={(file, box) => {
			draft.recrop(item.key, file, box)
			cropping = undefined
		}}
		oncancel={() => (cropping = undefined)}
	/>
{/if}

<style>
	.file-preview {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 6px;
		height: 100%;
		padding: 32px 12px 12px;
		font-size: 13px;
		overflow-wrap: anywhere;
	}
	.file-preview strong {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.file-preview span {
		color: var(--text-2);
	}
	.tray {
		/* The tiles' offsets are measured from here while dragging. */
		position: relative;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
		gap: 8px;
		margin: 8px 0;
		padding: 0;
		list-style: none;
	}
	.thumb {
		position: relative;
		aspect-ratio: 1;
		border-radius: 12px;
		overflow: hidden;
		background: var(--img-fallback);
		cursor: grab;
		/* Dragging a tile shouldn't scroll the page; the modal still scrolls outside the tray. */
		touch-action: none;
		user-select: none;
		transition:
			box-shadow 0.15s,
			scale 0.15s;
	}
	.thumb:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.dragging {
		z-index: 1;
		cursor: grabbing;
		scale: 1.05;
		box-shadow: var(--shadow-pop);
	}
	img,
	video {
		width: 100%;
		height: 100%;
		object-fit: cover;
		pointer-events: none;
	}
	.failed img,
	.failed video {
		opacity: 0.4;
	}
	.badge {
		position: absolute;
		display: flex;
		align-items: center;
		left: 8px;
		bottom: 8px;
		background: rgba(0, 0, 0, 0.72);
		color: #fff;
		font-size: 11px;
		font-weight: 800;
		padding: 1px 5px;
		border-radius: 4px;
	}
	.status {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		background: rgba(0, 0, 0, 0.35);
		color: #fff;
		font-size: 13px;
		font-weight: 700;
		text-align: center;
		padding: 8px;
	}
	.failed-note {
		background: none;
		color: var(--danger);
	}
	.spinner {
		width: 24px;
		height: 24px;
		border: 3px solid rgba(255, 255, 255, 0.4);
		border-top-color: #fff;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	.corner {
		position: absolute;
		top: 6px;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.72);
		color: #fff;
		display: grid;
		place-items: center;
	}
	.remove {
		right: 6px;
	}
	.alt {
		position: absolute;
		right: 6px;
		bottom: 6px;
		display: flex;
		align-items: center;
		gap: 2px;
		min-height: 24px;
		padding: 0 7px;
		border-radius: 6px;
		background: rgba(0, 0, 0, 0.72);
		color: #fff;
		font-size: 12px;
		font-weight: 800;
		letter-spacing: 0.04em;
	}
	.alt.described {
		padding-left: 4px;
	}
	.crop {
		left: 6px;
	}
	@media (prefers-reduced-motion: reduce) {
		.thumb {
			transition: none;
		}
	}
</style>
