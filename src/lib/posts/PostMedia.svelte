<script lang="ts">
	import Carousel from './Carousel.svelte'
	import MediaItem, { position_label } from './MediaItem.svelte'
	import type { Media } from './types'
	import { file_size } from '#lib/files'
	import { m } from '#lib/paraglide/messages.js'

	let {
		media,
		focus = false,
		onswipe,
	}: {
		media: Media[]
		focus?: boolean
		onswipe?: (swiped: boolean, top: number) => void
	} = $props()

	const visual = $derived(media.filter((item) => item.kind !== 'file'))
	const files = $derived(media.filter((item) => item.kind === 'file'))
	const [first] = $derived(visual)
</script>

{#if visual.length > 1}
	<Carousel media={visual} {focus} {onswipe} />
{:else if first}
	<div class="single" style:--r={first.width / first.height}>
		<MediaItem item={first} label={position_label(first, 1, 1)} eager />
	</div>
{/if}

{#if files.length}
	<div class="files">
		{#each files as file (file.url)}
			<a class="file-attachment" href={file.url} download={file.name}>
				<strong>{file.name}</strong>
				<span>{file_size(file.size ?? 0)} · {m.post_download_file()}</span>
			</a>
		{/each}
	</div>
{/if}

<style>
	.files {
		display: grid;
		gap: 8px;
		margin-top: 12px;
	}
	.file-attachment {
		display: grid;
		gap: 4px;
		padding: 12px 16px;
		border: 1px solid var(--line);
		border-radius: var(--r-card);
		overflow-wrap: anywhere;
	}
	.file-attachment:hover {
		background: var(--bg-2);
	}
	.file-attachment span {
		color: var(--text-2);
		font-size: 13px;
	}
	/*
	 * One photo keeps its own shape, uncropped: full width, or narrower when a tall photo would
	 * otherwise pass 600px (or 70% of the screen) high, matching the carousel.
	 */
	.single {
		margin-top: 12px;
		width: min(100%, calc(min(600px, 70svh) * var(--r)));
		aspect-ratio: var(--r);
		border-radius: var(--r-card);
		overflow: hidden;
		border: 1px solid var(--line);
	}
</style>
