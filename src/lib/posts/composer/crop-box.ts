/** A crop rectangle in the photo's own pixels. */
export type CropBox = { x: number; y: number; w: number; h: number }
export type ImageSize = { w: number; h: number }

/** Which part of the box a drag grabbed: its inside, an edge, or a corner. */
export type Handle = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

/** The shapes on offer; `undefined` is free, `original` is the photo's own shape. */
export type Aspect = { id: string; ratio?: number | 'original' }

export const ASPECTS: Aspect[] = [
	{ id: 'original', ratio: 'original' },
	{ id: 'free' },
	{ id: '1:1', ratio: 1 },
	{ id: '4:5', ratio: 4 / 5 },
	{ id: '3:4', ratio: 3 / 4 },
	{ id: '4:3', ratio: 4 / 3 },
	{ id: '16:9', ratio: 16 / 9 },
]

/** The smallest crop, as a share of the photo's shorter side. */
const MIN_SHARE = 0.08

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))

/** The width/height a crop is held to, or undefined when it's free. */
export function aspect_ratio(aspect: Aspect, image: ImageSize) {
	return aspect.ratio === 'original' ? image.w / image.h : aspect.ratio
}

const min_side = (image: ImageSize) => Math.min(image.w, image.h) * MIN_SHARE

/** The whole photo, or the largest centred box of `ratio` inside it. */
export function initial_box(image: ImageSize, ratio?: number): CropBox {
	if (!ratio) return { x: 0, y: 0, ...image }
	const w = Math.min(image.w, image.h * ratio)
	const h = w / ratio
	return { x: (image.w - w) / 2, y: (image.h - h) / 2, w, h }
}

/** Slide the box by a drag, keeping it inside the photo. */
function move(box: CropBox, dx: number, dy: number, image: ImageSize): CropBox {
	return {
		...box,
		x: clamp(box.x + dx, 0, image.w - box.w),
		y: clamp(box.y + dy, 0, image.h - box.h),
	}
}

/** Drag the grabbed edges freely, keeping them inside the photo and apart. */
function resize_free(box: CropBox, handle: Handle, dx: number, dy: number, image: ImageSize) {
	const min = min_side(image)
	let [left, top, right, bottom] = [box.x, box.y, box.x + box.w, box.y + box.h]
	if (handle.includes('w')) left = clamp(left + dx, 0, right - min)
	if (handle.includes('e')) right = clamp(right + dx, left + min, image.w)
	if (handle.includes('n')) top = clamp(top + dy, 0, bottom - min)
	if (handle.includes('s')) bottom = clamp(bottom + dy, top + min, image.h)
	return { x: left, y: top, w: right - left, h: bottom - top }
}

/**
 * Drag while holding the shape. The side or corner opposite the handle stays put; an edge
 * handle keeps the box centred across the other way.
 */
function resize_locked(
	box: CropBox,
	handle: Handle,
	dx: number,
	dy: number,
	image: ImageSize,
	ratio: number,
) {
	const horizontal = handle.includes('e') || handle.includes('w')
	const vertical = handle.includes('n') || handle.includes('s')
	const grow_x = handle.includes('w') ? -dx : dx
	const grow_y = handle.includes('n') ? -dy : dy
	// A corner follows whichever direction the drag changed more.
	const from_x = box.w + grow_x
	const from_y = (box.h + grow_y) * ratio
	let w = horizontal && vertical ? Math.max(from_x, from_y) : horizontal ? from_x : from_y

	const cx = box.x + box.w / 2
	const cy = box.y + box.h / 2
	const room_w = handle.includes('w')
		? box.x + box.w
		: handle.includes('e')
			? image.w - box.x
			: 2 * Math.min(cx, image.w - cx)
	const room_h = handle.includes('n')
		? box.y + box.h
		: handle.includes('s')
			? image.h - box.y
			: 2 * Math.min(cy, image.h - cy)
	const min_w = Math.max(min_side(image), min_side(image) * ratio)
	w = clamp(w, Math.min(min_w, room_w, room_h * ratio), Math.min(room_w, room_h * ratio))
	const h = w / ratio

	const x = handle.includes('w') ? box.x + box.w - w : handle.includes('e') ? box.x : cx - w / 2
	const y = handle.includes('n') ? box.y + box.h - h : handle.includes('s') ? box.y : cy - h / 2
	return { x, y, w, h }
}

/** Apply a drag of `dx`, `dy` photo pixels on `handle`. */
export function drag_box(
	box: CropBox,
	handle: Handle,
	dx: number,
	dy: number,
	image: ImageSize,
	ratio?: number,
): CropBox {
	if (handle === 'move') return move(box, dx, dy, image)
	if (!ratio) return resize_free(box, handle, dx, dy, image)
	return resize_locked(box, handle, dx, dy, image, ratio)
}

/** The size a crop is saved at: its own pixels, the long side capped so uploads stay small. */
export function crop_output(box: CropBox, max_side = 2048) {
	const k = Math.min(1, max_side / Math.max(box.w, box.h))
	return { w: Math.max(1, Math.round(box.w * k)), h: Math.max(1, Math.round(box.h * k)) }
}

/** Whether a crop leaves the photo as it was, so there's nothing to upload again. */
export const is_whole = (box: CropBox, image: ImageSize) =>
	box.x < 0.5 && box.y < 0.5 && Math.abs(box.w - image.w) < 1 && Math.abs(box.h - image.h) < 1
