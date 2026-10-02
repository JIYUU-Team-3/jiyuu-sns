/*
 * Transparent mode leaves the sticky bars fully see-through, so whatever scrolls under them would
 * stack on their text. Instead, everything after a bar is clipped at the bar's bottom edge (an
 * in-page backdrop blur would only blur page pixels, not the window behind them).
 * Bars opt in with `data-clip-bar`.
 */
import { MediaQuery } from 'svelte/reactivity'
import { prefs } from './prefs.svelte'

/**
 * Transparent mode is for desktop browsers: a wide window with a mouse or trackpad, so phones and
 * tablets never get it, whatever their width. app.css gates its styles on the same query.
 */
export const DESKTOP = '(min-width: 701px) and (hover: hover) and (pointer: fine)'

/** Whether this device can use transparent mode. False while rendering on the server. */
export const desktop = new MediaQuery(DESKTOP, false)

function clip_siblings(bar: Element, edge: number, clipped: Set<HTMLElement>) {
	for (let el = bar.nextElementSibling; el; el = el.nextElementSibling) {
		if (!(el instanceof HTMLElement)) continue
		const top = Math.max(0, edge - el.getBoundingClientRect().top)
		if (!top) continue
		el.style.clipPath = `inset(${top}px 0 0 0)`
		clipped.add(el)
	}
}

function start_clipping() {
	let clipped = new Set<HTMLElement>()
	let queued = false

	const clip = () => {
		queued = false
		const next = new Set<HTMLElement>()
		for (const bar of document.querySelectorAll('[data-clip-bar]')) {
			clip_siblings(bar, bar.getBoundingClientRect().bottom, next)
		}
		for (const el of clipped) if (!next.has(el)) el.style.clipPath = ''
		clipped = next
	}
	const queue = () => {
		if (queued) return
		queued = true
		requestAnimationFrame(clip)
	}

	// Capture, so the side rail's own scrolling counts too.
	addEventListener('scroll', queue, { passive: true, capture: true })
	addEventListener('resize', queue)
	const observer = new MutationObserver(queue)
	observer.observe(document.body, { childList: true, subtree: true })
	queue()

	return () => {
		removeEventListener('scroll', queue, { capture: true })
		removeEventListener('resize', queue)
		observer.disconnect()
		for (const el of clipped) el.style.clipPath = ''
	}
}

/** Keep content clipped under the sticky bars while transparent mode is on. */
export function clip_under_bars() {
	$effect(() => {
		if (prefs.clear_shown && desktop.current) return start_clipping()
	})
}
