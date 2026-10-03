/** Motion and measuring shared by the text morphs (`TextMorph`, `NumberRoll`). */
import { reduced_motion } from '#lib/settings/motion'

const EXPO_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)'
export const MOVE = { duration: 320, easing: EXPO_OUT }
export const FADE_IN = { duration: 260, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' } as const
export const FADE_OUT = { duration: 200, easing: 'ease-in-out', fill: 'forwards' } as const
export const SWAP_OUT = { duration: 180, easing: 'ease-out', fill: 'forwards' } as const
export const BLUR = 'blur(3px)'

export type Spot = { x: number; y: number }

/** The side text is anchored to: that edge stays put while the width changes. */
export type Anchor = 'start' | 'end'

export const still = reduced_motion

/** Where each element sits, from the base box's top corner on the `anchor` side (right by default). */
export function spots(
	base: Element,
	elements: Iterable<Element | Range>,
	anchor: Anchor = 'end',
): Spot[] {
	const box = base.getBoundingClientRect()
	const edge = anchor === 'end' ? box.right : box.left
	return Array.from(elements, (el) => {
		const rect = el.getBoundingClientRect()
		return { x: rect.left - edge, y: rect.top - box.top }
	})
}

/**
 * Put a ghost's text exactly where its letter was. Its spot is from the anchored edge, and as a
 * block its text sits half a line's leading lower than an inline letter; move it by the miss.
 */
export function align(base: Element, el: HTMLElement, spot: Spot, anchor: Anchor = 'end') {
	const range = document.createRange()
	range.selectNodeContents(el)
	const [at] = spots(base, [range], anchor)
	el.style.left = `${el.offsetLeft + spot.x - at.x}px`
	el.style.top = `${el.offsetTop + spot.y - at.y}px`
}

/** Ease the box from its old width to its new one. */
export function ease_width(el: HTMLElement, from: number) {
	const to = el.getBoundingClientRect().width
	if (Math.abs(from - to) >= 0.5) el.animate({ width: [`${from}px`, `${to}px`] }, MOVE)
}
