<script lang="ts">
	import { onMount } from 'svelte'
	import { m } from '#lib/paraglide/messages.js'
	import Icon from '#lib/ui/Icon.svelte'
	import Modal from '#lib/ui/Modal.svelte'
	import {
		ASPECTS,
		aspect_ratio,
		drag_box,
		initial_box,
		is_whole,
		type Aspect,
		type CropBox,
		type Handle,
		type ImageSize,
	} from './crop-box'
	import { render_photo } from './render-crop'

	let {
		file,
		start,
		onapply,
		oncancel,
	}: {
		/** The photo as picked, never an earlier crop of it. */
		file: File
		/** The previous crop, to pick up where it was left. */
		start?: CropBox
		onapply: (cropped: File, box: CropBox) => void
		oncancel: () => void
	} = $props()

	const HANDLES: Handle[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']
	const HINT_ID = 'photo-crop-hint'
	/** Arrow keys move the box this many screen pixels. */
	const NUDGE = 10

	// The cropper opens for one file and closes before another, so reading it once is right.
	// svelte-ignore state_referenced_locally
	const src = URL.createObjectURL(file)
	let img = $state<HTMLImageElement>()
	let natural = $state<ImageSize>()
	let shown_w = $state(0)
	// svelte-ignore state_referenced_locally
	let aspect = $state<Aspect>(start ? ASPECTS[1] : ASPECTS[0])
	let box = $state<CropBox>()
	let busy = $state(false)
	let drag: { id: number; handle: Handle; x: number; y: number; from: CropBox } | undefined

	/** Screen pixels per photo pixel. */
	const scale = $derived(natural && shown_w ? shown_w / natural.w : 0)
	const ratio = $derived(natural && aspect_ratio(aspect, natural))

	function loaded() {
		if (!img) return
		natural = { w: img.naturalWidth, h: img.naturalHeight }
		box = start ?? initial_box(natural)
	}

	function choose(next: Aspect) {
		aspect = next
		if (natural) box = initial_box(natural, aspect_ratio(next, natural))
	}

	function onpointerdown(event: PointerEvent) {
		const handle = (event.target as HTMLElement).dataset.handle as Handle | undefined
		if (!handle || !box) return
		;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
		drag = { id: event.pointerId, handle, x: event.clientX, y: event.clientY, from: box }
	}

	function onpointermove(event: PointerEvent) {
		if (drag?.id !== event.pointerId || !natural || !scale) return
		const dx = (event.clientX - drag.x) / scale
		const dy = (event.clientY - drag.y) / scale
		box = drag_box(drag.from, drag.handle, dx, dy, natural, ratio)
	}

	function onkeydown(event: KeyboardEvent) {
		const step = { x: 0, y: 0 }
		if (event.key === 'ArrowLeft') step.x = -NUDGE
		else if (event.key === 'ArrowRight') step.x = NUDGE
		else if (event.key === 'ArrowUp') step.y = -NUDGE
		else if (event.key === 'ArrowDown') step.y = NUDGE
		else return
		event.preventDefault()
		if (box && natural && scale) {
			box = drag_box(box, 'move', step.x / scale, step.y / scale, natural, ratio)
		}
	}

	async function apply() {
		if (!img || !natural || !box || busy) return
		// An untouched first crop changes nothing, so there's nothing to upload again.
		if (!start && is_whole(box, natural)) return oncancel()
		busy = true
		const cropped = await render_photo(img, box, file)
		busy = false
		if (cropped) onapply(cropped, box)
	}

	onMount(() => () => URL.revokeObjectURL(src))

	const label = (aspect: Aspect) =>
		aspect.id === 'original'
			? m.composer_crop_original()
			: aspect.id === 'free'
				? m.composer_crop_free()
				: aspect.id
</script>

<Modal label={m.composer_crop_title()} onrequestclose={oncancel}>
	<div class="head">
		<button type="button" class="icon-btn" aria-label={m.dialog_cancel()} onclick={oncancel}>
			<Icon name="x" />
		</button>
		<h2>{m.composer_crop_title()}</h2>
		<button type="button" class="btn btn-primary sm" disabled={!box || busy} onclick={apply}
			>{m.crop_apply()}</button
		>
	</div>

	<div class="stage">
		<div class="photo" bind:clientWidth={shown_w}>
			<img bind:this={img} {src} alt="" draggable="false" onload={loaded} />
			{#if box && scale}
				<!-- A drag surface that also takes arrow keys, which the "application" role hands to it. -->
				<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
				<div
					class="box"
					role="application"
					aria-label={m.crop_area()}
					aria-describedby={HINT_ID}
					tabindex="0"
					data-autofocus
					data-handle="move"
					style:left="{box.x * scale}px"
					style:top="{box.y * scale}px"
					style:width="{box.w * scale}px"
					style:height="{box.h * scale}px"
					{onpointerdown}
					{onpointermove}
					onpointerup={() => (drag = undefined)}
					onpointercancel={() => (drag = undefined)}
					{onkeydown}
				>
					<!-- Rule-of-thirds grid. -->
					<span class="grid v1"></span><span class="grid v2"></span>
					<span class="grid h1"></span><span class="grid h2"></span>
					{#each HANDLES as handle (handle)}
						<span class="handle {handle}" data-handle={handle}></span>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<div class="aspects" role="group" aria-label={m.composer_crop_aspect()}>
		{#each ASPECTS as option (option.id)}
			<button
				type="button"
				class="chip"
				aria-pressed={aspect.id === option.id}
				onclick={() => choose(option)}>{label(option)}</button
			>
		{/each}
	</div>
	<p id={HINT_ID} class="hint">{m.composer_crop_hint()}</p>
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
	.stage {
		display: grid;
		place-items: center;
		padding: 16px;
		background: var(--bg-3);
	}
	.photo {
		position: relative;
		line-height: 0;
		user-select: none;
	}
	img {
		display: block;
		max-width: 100%;
		max-height: 60vh;
		pointer-events: none;
	}
	.box {
		position: absolute;
		/* Everything outside the crop is dimmed. */
		box-shadow: 0 0 0 100vmax color-mix(in srgb, #000 55%, transparent);
		outline: 1px solid rgba(255, 255, 255, 0.9);
		cursor: move;
		touch-action: none;
	}
	/* Clips the dimming to the stage, leaving room around the photo for the edge handles. */
	.stage {
		overflow: hidden;
	}
	.box:focus-visible {
		outline: 2px solid var(--accent);
	}
	.grid {
		position: absolute;
		background: rgba(255, 255, 255, 0.45);
		pointer-events: none;
	}
	.v1,
	.v2 {
		top: 0;
		bottom: 0;
		width: 1px;
	}
	.v1 {
		left: 33.333%;
	}
	.v2 {
		left: 66.667%;
	}
	.h1,
	.h2 {
		left: 0;
		right: 0;
		height: 1px;
	}
	.h1 {
		top: 33.333%;
	}
	.h2 {
		top: 66.667%;
	}
	/* Handles are drawn small but grabbed from a bigger area, for fingers. */
	.handle {
		position: absolute;
		width: 28px;
		height: 28px;
		translate: -50% -50%;
	}
	.handle::after {
		content: '';
		position: absolute;
		inset: 9px;
		background: #fff;
		border-radius: 2px;
		box-shadow: 0 0 2px rgba(0, 0, 0, 0.6);
	}
	.n,
	.s {
		left: 50%;
		cursor: ns-resize;
	}
	.e,
	.w {
		top: 50%;
		cursor: ew-resize;
	}
	.n,
	.ne,
	.nw {
		top: 0;
	}
	.s,
	.se,
	.sw {
		top: 100%;
	}
	.w,
	.nw,
	.sw {
		left: 0;
	}
	.e,
	.ne,
	.se {
		left: 100%;
	}
	.nw,
	.se {
		cursor: nwse-resize;
	}
	.ne,
	.sw {
		cursor: nesw-resize;
	}
	.aspects {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		padding: 16px 16px 4px;
	}
	.chip {
		padding: 6px 12px;
		border-radius: 999px;
		border: 1px solid var(--line-2);
		font-size: 14px;
		font-weight: 600;
		color: var(--text-2);
		transition:
			background-color 0.15s,
			color 0.15s;
	}
	.chip:hover {
		background: var(--bg-2);
	}
	.chip[aria-pressed='true'] {
		background: var(--accent-soft);
		border-color: var(--accent);
		color: var(--accent-text);
	}
	.hint {
		font-size: 13px;
		color: var(--text-2);
		margin: 0;
		padding: 4px 16px 16px;
	}
</style>
