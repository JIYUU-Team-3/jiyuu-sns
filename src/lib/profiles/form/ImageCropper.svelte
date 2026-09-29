<script lang="ts">
	import type { Attachment } from 'svelte/attachments'
	import type { ImageKind } from '#lib/media'
	import { m } from '#lib/paraglide/messages.js'
	import Icon from '#lib/ui/Icon.svelte'
	import Modal from '#lib/ui/Modal.svelte'
	import {
		CENTERED,
		clamp_crop,
		CROP_OUTPUT,
		image_box,
		MAX_ZOOM,
		output_size,
		pan_crop,
		render_crop,
		source_rect,
		type Crop,
		type Size,
	} from './crop'

	let {
		src,
		kind,
		onapply,
		oncancel,
	}: {
		/** The picked original, as an object URL. */
		src: string
		kind: ImageKind
		onapply: (blob: Blob) => void
		oncancel: () => void
	} = $props()

	// Only one cropper is open at a time.
	const HINT_ID = 'crop-hint'
	/** Arrow keys move the image this many screen pixels. */
	const NUDGE = 10

	let img = $state<HTMLImageElement>()
	let natural = $state<Size>()
	let frame_w = $state(0)
	let frame_h = $state(0)
	let crop = $state<Crop>(CENTERED)
	let busy = $state(false)
	let drag: { id: number; x: number; y: number } | undefined

	const frame = $derived<Size>({ w: frame_w, h: frame_h })
	const box = $derived(natural && frame_w ? image_box(crop, natural, frame) : undefined)

	function set_crop(next: Crop) {
		if (natural && frame_w) crop = clamp_crop(next, natural, frame)
	}

	function pan(dx: number, dy: number) {
		if (natural && frame_w) crop = pan_crop(crop, dx, dy, natural, frame)
	}

	function onpointerdown(event: PointerEvent) {
		// Capture keeps the drag going off the frame, and keeps its click off the scrim.
		;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
		drag = { id: event.pointerId, x: event.clientX, y: event.clientY }
	}

	function onpointermove(event: PointerEvent) {
		if (drag?.id !== event.pointerId) return
		pan(event.clientX - drag.x, event.clientY - drag.y)
		drag = { ...drag, x: event.clientX, y: event.clientY }
	}

	/** The pan for an arrow key, as the drag that would move the image that way. */
	function arrow_pan(key: string): [number, number] | undefined {
		if (key === 'ArrowLeft') return [NUDGE, 0]
		if (key === 'ArrowRight') return [-NUDGE, 0]
		if (key === 'ArrowUp') return [0, NUDGE]
		if (key === 'ArrowDown') return [0, -NUDGE]
	}

	function onkeydown(event: KeyboardEvent) {
		const move = arrow_pan(event.key)
		if (!move) return
		event.preventDefault()
		pan(...move)
	}

	/** Wheel zoom; added by hand because it has to be able to stop the dialog scrolling. */
	const wheel_zoom: Attachment<HTMLElement> = (node) => {
		const onwheel = (event: WheelEvent) => {
			event.preventDefault()
			set_crop({ ...crop, zoom: crop.zoom * Math.exp(-event.deltaY * 0.002) })
		}
		node.addEventListener('wheel', onwheel, { passive: false })
		return () => node.removeEventListener('wheel', onwheel)
	}

	async function apply() {
		if (!img || !natural || busy) return
		busy = true
		const source = source_rect(crop, natural, CROP_OUTPUT[kind])
		const blob = await render_crop(img, source, output_size(source, CROP_OUTPUT[kind]))
		busy = false
		if (blob) onapply(blob)
	}
</script>

<Modal
	label={kind === 'avatar' ? m.crop_avatar_title() : m.crop_banner_title()}
	onrequestclose={oncancel}
>
	<div class="head">
		<button type="button" class="icon-btn" aria-label={m.dialog_cancel()} onclick={oncancel}>
			<Icon name="x" />
		</button>
		<h2>{kind === 'avatar' ? m.crop_avatar_title() : m.crop_banner_title()}</h2>
		<button type="button" class="btn btn-primary sm" disabled={!natural || busy} onclick={apply}
			>{m.crop_apply()}</button
		>
	</div>

	<div class="stage">
		<!-- A drag surface that also takes arrow keys, which the "application" role hands to it.
		     Svelte doesn't count that role as interactive, hence the ignores. -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
		<div
			class="frame {kind}"
			role="application"
			aria-label={m.crop_area()}
			aria-describedby={HINT_ID}
			tabindex="0"
			data-autofocus
			bind:clientWidth={frame_w}
			bind:clientHeight={frame_h}
			{onpointerdown}
			{onpointermove}
			onpointerup={() => (drag = undefined)}
			onpointercancel={() => (drag = undefined)}
			{onkeydown}
			{@attach wheel_zoom}
		>
			<img
				bind:this={img}
				{src}
				alt=""
				draggable="false"
				class:ready={box}
				style:left="{box?.x ?? 0}px"
				style:top="{box?.y ?? 0}px"
				style:width="{box?.w ?? 0}px"
				style:height="{box?.h ?? 0}px"
				onload={() => {
					if (img) natural = { w: img.naturalWidth, h: img.naturalHeight }
				}}
			/>
		</div>
	</div>

	<div class="zoom">
		<Icon name="zoom" size="sm" />
		<input
			type="range"
			min="1"
			max={MAX_ZOOM}
			step="0.01"
			aria-label={m.crop_zoom()}
			bind:value={() => crop.zoom, (zoom) => set_crop({ ...crop, zoom })}
		/>
	</div>
	<p id={HINT_ID} class="hint">{m.crop_hint()}</p>
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
		justify-items: center;
		padding: 16px;
		background: var(--bg-3);
	}
	.frame {
		position: relative;
		width: 100%;
		overflow: hidden;
		cursor: grab;
		/* Touch drags pan the image instead of scrolling the dialog. */
		touch-action: none;
		user-select: none;
	}
	.frame:active {
		cursor: grabbing;
	}
	.frame.avatar {
		max-width: 320px;
		aspect-ratio: 1;
	}
	.frame.banner {
		aspect-ratio: 3 / 1;
	}
	/* The avatar shows as a circle, so the corners outside it are dimmed. */
	.frame.avatar::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: 50%;
		box-shadow: 0 0 0 100vmax color-mix(in srgb, #000 55%, transparent);
		pointer-events: none;
	}
	img {
		position: absolute;
		max-width: none;
		visibility: hidden;
		pointer-events: none;
	}
	img.ready {
		visibility: visible;
	}
	.zoom {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 16px 16px 4px;
		color: var(--text-2);
	}
	.zoom input {
		flex: 1;
		accent-color: var(--accent-fill);
	}
	.hint {
		font-size: 13px;
		color: var(--text-2);
		margin: 0;
		padding: 0 16px 16px;
	}
</style>
