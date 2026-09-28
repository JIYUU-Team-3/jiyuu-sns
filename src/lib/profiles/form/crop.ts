import type { ImageKind } from '#lib/media'

export type Size = { w: number; h: number }
export type Rect = Size & { x: number; y: number }

/**
 * How a picked image sits in the crop frame: the zoom over "just covers the frame", and the
 * point of the image under the frame's centre, as fractions of its width and height. Kept
 * relative so it holds when the frame changes size.
 */
export type Crop = { zoom: number; cx: number; cy: number }

export const CENTERED: Crop = { zoom: 1, cx: 0.5, cy: 0.5 }
export const MAX_ZOOM = 4

/** The size each kind is saved at, or smaller when the cropped area has fewer pixels. */
export const CROP_OUTPUT: Record<ImageKind, Size> = {
	avatar: { w: 400, h: 400 },
	banner: { w: 1500, h: 500 },
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** Screen pixels per image pixel. */
const scale = (image: Size, frame: Size, zoom: number) =>
	Math.max(frame.w / image.w, frame.h / image.h) * zoom

/** Keep the zoom in range and the image covering the whole frame. */
export function clamp_crop(crop: Crop, image: Size, frame: Size): Crop {
	const zoom = clamp(crop.zoom, 1, MAX_ZOOM)
	const s = scale(image, frame, zoom)
	// Half the frame, as a fraction of the image; the centre can't come closer to an edge.
	const half_w = frame.w / (2 * image.w * s)
	const half_h = frame.h / (2 * image.h * s)
	return {
		zoom,
		cx: clamp(crop.cx, half_w, 1 - half_w),
		cy: clamp(crop.cy, half_h, 1 - half_h),
	}
}

/** Move the image by a drag of `dx`, `dy` screen pixels. */
export function pan_crop(crop: Crop, dx: number, dy: number, image: Size, frame: Size): Crop {
	const s = scale(image, frame, crop.zoom)
	const moved = { ...crop, cx: crop.cx - dx / (image.w * s), cy: crop.cy - dy / (image.h * s) }
	return clamp_crop(moved, image, frame)
}

/** Where the image is drawn, relative to the frame's top-left corner, in screen pixels. */
export function image_box(crop: Crop, image: Size, frame: Size): Rect {
	const s = scale(image, frame, crop.zoom)
	const w = image.w * s
	const h = image.h * s
	return { x: frame.w / 2 - crop.cx * w, y: frame.h / 2 - crop.cy * h, w, h }
}

/** The part of the image inside the frame, in image pixels. Only the frame's shape matters. */
export function source_rect(crop: Crop, image: Size, frame: Size): Rect {
	const { zoom, cx, cy } = clamp_crop(crop, image, frame)
	const s = scale(image, frame, zoom)
	const w = frame.w / s
	const h = frame.h / s
	return { x: cx * image.w - w / 2, y: cy * image.h - h / 2, w, h }
}

/** The output size: the kind's size, shrunk to the source's pixels so nothing is upscaled. */
export function output_size(source: Rect, target: Size): Size {
	const k = Math.min(1, source.w / target.w)
	return { w: Math.max(1, Math.round(target.w * k)), h: Math.max(1, Math.round(target.h * k)) }
}

/** Draw the cropped part of a loaded image at `out` size, as WebP where the browser can. */
export function render_crop(image: HTMLImageElement, source: Rect, out: Size) {
	const canvas = document.createElement('canvas')
	canvas.width = out.w
	canvas.height = out.h
	const context = canvas.getContext('2d')
	if (!context) return Promise.resolve(null)
	context.imageSmoothingQuality = 'high'
	context.drawImage(image, source.x, source.y, source.w, source.h, 0, 0, out.w, out.h)
	// Browsers without a WebP encoder (Safari) fall back to PNG.
	return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9))
}
