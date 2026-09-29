/** Space between slides, in pixels. */
export const SLIDE_GAP = 4

/** Slides share one height, taller for tall photos but never past this. */
const MIN_HEIGHT = 320
const MAX_HEIGHT = 600
/** How wide the tallest photo would like to be. */
const TALL_WIDTH = 380
/** The widest a scrolling slide gets, as a share of the text column. */
const MAX_SLIDE_SHARE = 0.82
/** Below this, a pair squeezed side by side is too small to see, so it scrolls instead. */
const MIN_FIT_HEIGHT = 200

export type CarouselSize = {
	/** The one height every slide gets; each is as wide as its ratio makes it, uncropped. */
	height: number
	/** Whether every slide fits in the text column at once, so nothing scrolls. */
	fits: boolean
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))

/**
 * Size a carousel from its photos' width/height ratios and the text column's width (0 before
 * it's measured). Two photos sit side by side in the column when that leaves them a usable
 * height; otherwise the tallest photo sets the height, lowered so the widest still fits.
 */
export function carousel_size(ratios: number[], column: number): CarouselSize {
	const preferred = clamp(TALL_WIDTH / Math.min(...ratios), MIN_HEIGHT, MAX_HEIGHT)
	if (!column) return { height: preferred, fits: false }

	const total = ratios.reduce((sum, ratio) => sum + ratio, 0)
	const side_by_side = (column - SLIDE_GAP * (ratios.length - 1)) / total
	if (ratios.length === 2 && side_by_side >= MIN_FIT_HEIGHT) {
		return { height: Math.min(side_by_side, MAX_HEIGHT), fits: true }
	}
	const widest = (column * MAX_SLIDE_SHARE) / Math.max(...ratios)
	return { height: Math.min(preferred, widest), fits: false }
}
