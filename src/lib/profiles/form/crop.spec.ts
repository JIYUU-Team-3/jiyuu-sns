import { describe, expect, it } from 'vitest'
import {
	CENTERED,
	clamp_crop,
	image_box,
	MAX_ZOOM,
	output_size,
	pan_crop,
	source_rect,
	type Size,
} from './crop'

const SQUARE: Size = { w: 300, h: 300 }
const WIDE: Size = { w: 600, h: 200 }
const LANDSCAPE: Size = { w: 900, h: 600 }
const PORTRAIT: Size = { w: 600, h: 900 }

const inside = (image: Size, frame: Size, crop = CENTERED) => {
	const rect = source_rect(crop, image, frame)
	expect(rect.x).toBeGreaterThanOrEqual(-1e-9)
	expect(rect.y).toBeGreaterThanOrEqual(-1e-9)
	expect(rect.x + rect.w).toBeLessThanOrEqual(image.w + 1e-9)
	expect(rect.y + rect.h).toBeLessThanOrEqual(image.h + 1e-9)
	return rect
}

describe('source_rect', () => {
	it('takes the centred square from a landscape image', () => {
		expect(source_rect(CENTERED, LANDSCAPE, SQUARE)).toEqual({ x: 150, y: 0, w: 600, h: 600 })
	})

	it('keeps the frame shape at any zoom', () => {
		const rect = source_rect({ zoom: 2.5, cx: 0.3, cy: 0.6 }, PORTRAIT, WIDE)
		expect(rect.w / rect.h).toBeCloseTo(3)
	})

	it('stays inside the image at every pan and zoom extreme', () => {
		for (const image of [LANDSCAPE, PORTRAIT])
			for (const frame of [SQUARE, WIDE])
				for (const zoom of [1, 2, MAX_ZOOM, 10])
					for (const cx of [-1, 0, 0.5, 1, 2])
						for (const cy of [-1, 0, 0.5, 1, 2]) inside(image, frame, { zoom, cx, cy })
	})

	it('only depends on the frame shape, not its size', () => {
		const crop = { zoom: 1.7, cx: 0.4, cy: 0.35 }
		expect(source_rect(crop, LANDSCAPE, WIDE)).toEqual(
			source_rect(crop, LANDSCAPE, { w: 1200, h: 400 }),
		)
	})
})

describe('clamp_crop', () => {
	it('allows no pan on the tight axis at zoom 1', () => {
		expect(clamp_crop({ zoom: 1, cx: 0.9, cy: 0.1 }, LANDSCAPE, SQUARE).cy).toBe(0.5)
		expect(clamp_crop({ zoom: 1, cx: 0.1, cy: 0.9 }, PORTRAIT, SQUARE).cx).toBe(0.5)
	})

	it('keeps zoom between 1 and the maximum', () => {
		expect(clamp_crop({ ...CENTERED, zoom: 0.2 }, LANDSCAPE, SQUARE).zoom).toBe(1)
		expect(clamp_crop({ ...CENTERED, zoom: 99 }, LANDSCAPE, SQUARE).zoom).toBe(MAX_ZOOM)
	})
})

describe('pan_crop', () => {
	it('moves the image with the drag, up to its edge', () => {
		// At zoom 1 a 900×600 image covers a 300 frame at 450×300, centred at x = -75.
		expect(image_box(CENTERED, LANDSCAPE, SQUARE).x).toBeCloseTo(-75)
		const moved = pan_crop(CENTERED, 50, 0, LANDSCAPE, SQUARE)
		expect(image_box(moved, LANDSCAPE, SQUARE).x).toBeCloseTo(-25)
		const right = pan_crop(CENTERED, 1000, 0, LANDSCAPE, SQUARE)
		expect(image_box(right, LANDSCAPE, SQUARE).x).toBeCloseTo(0)
		const left = pan_crop(CENTERED, -1000, 0, LANDSCAPE, SQUARE)
		expect(image_box(left, LANDSCAPE, SQUARE).x).toBeCloseTo(-150)
	})
})

describe('output_size', () => {
	it('uses the target size when the source has enough pixels', () => {
		expect(output_size({ x: 0, y: 0, w: 900, h: 900 }, { w: 400, h: 400 })).toEqual({
			w: 400,
			h: 400,
		})
	})

	it('never upscales, and never rounds a side to zero', () => {
		expect(output_size({ x: 0, y: 0, w: 150, h: 50 }, { w: 1500, h: 500 })).toEqual({
			w: 150,
			h: 50,
		})
		expect(output_size({ x: 0, y: 0, w: 0.5, h: 0.5 }, { w: 400, h: 400 })).toEqual({
			w: 1,
			h: 1,
		})
	})
})
