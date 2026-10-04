import { onDestroy } from 'svelte'
import { afterNavigate, beforeNavigate } from '$app/navigation'

/** How long to keep trying while the pages above the saved spot are still loading. */
const GIVE_UP = 3000

/** Where the reader left each page that keeps its place, and what it was showing then. */
const left: Record<string, { y: number; showing: string }> = {}

/**
 * Scrolls back to `y`, retrying each frame until the page is tall enough to get there. The
 * reader scrolling in the meantime wins. Returns the cancel.
 */
function restore_scroll(y: number) {
	const started = performance.now()
	let frame = 0

	const stop = () => {
		cancelAnimationFrame(frame)
		removeEventListener('wheel', stop)
		removeEventListener('touchstart', stop)
		removeEventListener('keydown', stop)
	}
	const step = () => {
		scrollTo({ top: y, behavior: 'instant' })
		if (Math.abs(scrollY - y) < 2 || performance.now() - started > GIVE_UP) return stop()
		frame = requestAnimationFrame(step)
	}

	addEventListener('wheel', stop, { passive: true })
	addEventListener('touchstart', stop, { passive: true })
	addEventListener('keydown', stop)
	step()
	return stop
}

/**
 * Called while the page for `route` (its route id) sets up: coming back to it from another page
 * returns to where the reader left it, instead of the top. A tap on the page's own nav item
 * still goes to the top.
 * `showing` names the content; if it differs on the way back, the old spot no longer applies.
 */
export function keep_scroll(route: string, showing: () => string = () => '') {
	let stop: (() => void) | undefined

	beforeNavigate(({ to }) => {
		left[route] = { y: to?.route.id === route ? 0 : scrollY, showing: showing() }
	})

	// After SvelteKit has put the new page at the top.
	afterNavigate(({ to }) => {
		if (to?.route.id !== route) return
		const spot = left[route]
		delete left[route]
		if (spot && spot.y > 0 && spot.showing === showing()) stop = restore_scroll(spot.y)
	})

	onDestroy(() => stop?.())
}
