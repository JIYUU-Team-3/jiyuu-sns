import { describe, expect, it } from 'vitest'
import { carousel_size, SLIDE_GAP } from './carousel-size'

const COLUMN = 520

describe('carousel_size', () => {
	it('fits two photos side by side, sharing one height', () => {
		const { height, fits } = carousel_size([0.75, 0.75], COLUMN)
		expect(fits).toBe(true)
		expect(height * 0.75 * 2 + SLIDE_GAP).toBeCloseTo(COLUMN)
	})

	it('scrolls a pair when fitting would make them too small', () => {
		expect(carousel_size([3, 3], COLUMN).fits).toBe(false)
	})

	it('caps a fitted pair at the maximum height', () => {
		expect(carousel_size([0.2, 0.2], COLUMN)).toEqual({ height: 600, fits: true })
	})

	it('lets tall photos stand taller when scrolling', () => {
		const tall = carousel_size([0.36, 0.36, 0.36], COLUMN).height
		const square = carousel_size([1, 1, 1], COLUMN).height
		expect(tall).toBeGreaterThan(square)
	})

	it('keeps the widest scrolling slide inside the column', () => {
		const ratios = [0.5, 2.5, 1]
		const { height } = carousel_size(ratios, COLUMN)
		expect(height * 2.5).toBeLessThanOrEqual(COLUMN * 0.82 + 0.001)
	})

	it('uses the preferred height before the column is measured', () => {
		expect(carousel_size([1, 1], 0)).toEqual({ height: 380, fits: false })
	})
})
