import type { Attachment } from 'svelte/attachments'

/**
 * Lets a sticky column taller than the window move with the page instead of scrolling on its own:
 * scrolling down carries it up until its end is in view, scrolling up brings it back until its
 * start is, and past either it stays put. Only `top` is moved; the element is `position: sticky`
 * in CSS and sits under whatever comes before it (the pinned search box).
 */
export const follow_scroll: Attachment<HTMLElement> = (node) => {
	let last = Math.max(0, scrollY)
	let shift = 0

	const place = () => {
		const head = (node.previousElementSibling as HTMLElement | null)?.offsetHeight ?? 0
		const lowest = Math.min(0, innerHeight - head - node.offsetHeight)
		// Safari reports a negative position while it bounces past the top.
		const y = Math.max(0, scrollY)
		shift = Math.max(lowest, Math.min(0, shift - (y - last)))
		last = y
		node.style.top = `${head + shift}px`
	}

	const observer = new ResizeObserver(place)
	observer.observe(node)
	addEventListener('scroll', place, { passive: true })
	addEventListener('resize', place)
	place()

	return () => {
		observer.disconnect()
		removeEventListener('scroll', place)
		removeEventListener('resize', place)
	}
}
