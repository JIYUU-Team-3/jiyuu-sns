/** Motion and measuring shared by the text morphs (`TextMorph`, `NumberRoll`). */

const EXPO_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)'
export const MOVE = { duration: 320, easing: EXPO_OUT }
export const FADE_IN = { duration: 260, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' } as const
export const FADE_OUT = { duration: 200, easing: 'ease-in-out', fill: 'forwards' } as const
export const SWAP_OUT = { duration: 180, easing: 'ease-out', fill: 'forwards' } as const
export const BLUR = 'blur(3px)'

export type Spot = { x: number; y: number }

export const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Where each element sits, from the base box's top right. The text is anchored right, so that
 * corner stays put while the width changes.
 */
export function spots(base: Element, elements: Iterable<Element | Range>): Spot[] {
	const box = base.getBoundingClientRect()
	return Array.from(elements, (el) => {
		const rect = el.getBoundingClientRect()
		return { x: rect.left - box.right, y: rect.top - box.top }
	})
}

/**
 * Put a ghost's text exactly where its letter was. Its spot is from the right edge, and as a
 * block its text sits half a line's leading lower than an inline letter; move it by the miss.
 */
export function align(base: Element, el: HTMLElement, spot: Spot) {
	const range = document.createRange()
	range.selectNodeContents(el)
	const [at] = spots(base, [range])
	el.style.left = `${el.offsetLeft + spot.x - at.x}px`
	el.style.top = `${el.offsetTop + spot.y - at.y}px`
}

/** Ease the box from its old width to its new one. */
export function ease_width(el: HTMLElement, from: number) {
	const to = el.getBoundingClientRect().width
	if (Math.abs(from - to) >= 0.5) el.animate({ width: [`${from}px`, `${to}px`] }, MOVE)
}
