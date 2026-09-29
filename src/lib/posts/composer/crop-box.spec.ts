import { describe, expect, it } from 'vitest'
import { crop_output, drag_box, initial_box, is_whole } from './crop-box'

const IMAGE = { w: 1000, h: 500 }

describe('initial_box', () => {
	it('covers the whole photo when free', () => {
		expect(initial_box(IMAGE)).toEqual({ x: 0, y: 0, w: 1000, h: 500 })
	})

	it('centres the largest box of a ratio', () => {
		expect(initial_box(IMAGE, 1)).toEqual({ x: 250, y: 0, w: 500, h: 500 })
	})
})

describe('drag_box', () => {
	const box = { x: 250, y: 0, w: 500, h: 500 }

	it('moves inside the photo only', () => {
		expect(drag_box(box, 'move', 900, 50, IMAGE)).toEqual({ x: 500, y: 0, w: 500, h: 500 })
	})

	it('resizes one edge freely and stops at the photo', () => {
		expect(drag_box(box, 'e', 1000, 0, IMAGE)).toEqual({ x: 250, y: 0, w: 750, h: 500 })
		expect(drag_box(box, 'n', 0, 100, IMAGE)).toEqual({ x: 250, y: 100, w: 500, h: 400 })
	})

	it('keeps the ratio from a corner, anchored at the opposite corner', () => {
		const next = drag_box(box, 'nw', 100, 100, IMAGE, 1)
		expect(next.w).toBeCloseTo(next.h)
		expect(next.x + next.w).toBeCloseTo(750)
		expect(next.y + next.h).toBeCloseTo(500)
	})

	it('keeps the ratio from an edge, centred the other way', () => {
		const small = { x: 400, y: 150, w: 200, h: 200 }
		const next = drag_box(small, 'e', 100, 0, IMAGE, 1)
		expect(next).toEqual({ x: 400, y: 100, w: 300, h: 300 })
	})

	it('never grows a locked box past the photo', () => {
		const next = drag_box(box, 'se', 800, 800, IMAGE, 1)
		expect(next.y + next.h).toBeLessThanOrEqual(500)
		expect(next.x + next.w).toBeLessThanOrEqual(1000)
		expect(next.w).toBeCloseTo(next.h)
	})
})

describe('crop_output', () => {
	it('keeps small crops at their own size and caps the long side', () => {
		expect(crop_output({ x: 0, y: 0, w: 300, h: 200 })).toEqual({ w: 300, h: 200 })
		expect(crop_output({ x: 0, y: 0, w: 4096, h: 2048 })).toEqual({ w: 2048, h: 1024 })
	})
})

describe('is_whole', () => {
	it('tells an untouched crop apart', () => {
		expect(is_whole(initial_box(IMAGE), IMAGE)).toBe(true)
		expect(is_whole(initial_box(IMAGE, 1), IMAGE)).toBe(false)
	})
})
