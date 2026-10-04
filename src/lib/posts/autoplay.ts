/*
 * Videos in lists: the one most in view plays, muted and looping, and every other one waits.
 * Tapping a video hands it to the viewer: sound on, native controls, no more autoplay for it.
 * While a video the viewer started is playing, nothing autoplays beside it; scrolled away, it
 * pauses, and autoplay picks up again.
 */
import { reduced_motion } from '#lib/settings/motion'
import { prefs } from '#lib/settings/prefs.svelte'

type Entry = {
	/** Share of the video on screen, 0 to 1. */
	ratio: number
	/** Tapped: the viewer plays and pauses it now. */
	manual: boolean
	/** In an iPhone's full-screen player, from the moment it starts opening. */
	fullscreen?: boolean
}

/** Less than this much of a video on screen and it doesn't count as in view. */
const IN_VIEW = 0.5
const THRESHOLDS = Array.from({ length: 11 }, (_, i) => i / 10)

const entries = new Map<HTMLVideoElement, Entry>()
let observer: IntersectionObserver | undefined

/** Created on first use: there's no IntersectionObserver during SSR. */
function watch(video: HTMLVideoElement) {
	observer ??= new IntersectionObserver(on_visibility, { threshold: THRESHOLDS })
	observer.observe(video)
}

function on_visibility(changes: IntersectionObserverEntry[]) {
	for (const change of changes) {
		const video = change.target as HTMLVideoElement
		const entry = entries.get(video)
		if (!entry) continue
		entry.ratio = change.intersectionRatio
		// Full screen takes it out of the page's flow on some browsers; that isn't scrolling away.
		if (entry.manual && entry.ratio < IN_VIEW && !in_fullscreen(video)) video.pause()
	}
	pick()
}

/** Whether the video fills the screen, by the standard API or an iPhone's own player. */
function in_fullscreen(video: HTMLVideoElement) {
	const ios = video as HTMLVideoElement & { webkitDisplayingFullscreen?: boolean }
	return (
		document.fullscreenElement === video ||
		entries.get(video)?.fullscreen ||
		!!ios.webkitDisplayingFullscreen
	)
}

/** How far a video's middle is from the screen's, to break ties between fully shown ones. */
function off_center(video: HTMLVideoElement) {
	const { top, height } = video.getBoundingClientRect()
	return Math.abs(top + height / 2 - innerHeight / 2)
}

/** The autoplay candidate most in view; the one nearest the middle among equals. */
function most_in_view() {
	// A video blurred behind the sensitive cover is `inert`, and stays still until it's shown.
	const candidates = [...entries].filter(
		([video, entry]) => !entry.manual && entry.ratio >= IN_VIEW && !video.closest('[inert]'),
	)
	candidates.sort(([a, x], [b, y]) => y.ratio - x.ratio || off_center(a) - off_center(b))
	return candidates[0]?.[0]
}

/** Whether a video the viewer started is still playing, which keeps autoplay quiet. */
const viewer_playing = () => [...entries].some(([video, entry]) => entry.manual && !video.paused)

/** Play the video most in view and pause every other autoplaying one. */
function pick() {
	const quiet = held > 0 || reduced_motion() || !prefs.value.autoplay || viewer_playing()
	const next = quiet ? undefined : most_in_view()
	for (const [video, entry] of entries) {
		if (!entry.manual && video !== next) video.pause()
	}
	if (next?.paused) {
		next.muted = true
		// Browsers may still refuse; the video then waits for a tap.
		next.play().catch(() => {})
	}
}

let held = 0

/**
 * Stop every list video while something covers the page (the full-screen viewer), so none plays
 * on unseen or talks over it. Returns the way to let autoplay go again.
 */
export function hold_autoplay() {
	held++
	for (const video of entries.keys()) video.pause()
	return () => {
		held--
		pick()
	}
}

function set_fullscreen(video: HTMLVideoElement, on: boolean) {
	const entry = entries.get(video)
	if (entry) entry.fullscreen = on
}

/** Attachment for a list video: joins autoplay while it's on the page. */
export function autoplay(video: HTMLVideoElement) {
	video.muted = true
	entries.set(video, { ratio: 0, manual: false })
	watch(video)
	video.addEventListener('pause', pick)
	// An iPhone announces its player before the page can see the video has left it.
	const begin = () => set_fullscreen(video, true)
	const end = () => set_fullscreen(video, false)
	video.addEventListener('webkitbeginfullscreen', begin)
	video.addEventListener('webkitendfullscreen', end)
	return () => {
		video.removeEventListener('webkitbeginfullscreen', begin)
		video.removeEventListener('webkitendfullscreen', end)
		observer?.unobserve(video)
		entries.delete(video)
		video.removeEventListener('pause', pick)
		pick()
	}
}

/** Hand a tapped video to the viewer: sound on, controls, playing; any other viewer video stops. */
export function take_control(video: HTMLVideoElement) {
	const entry = entries.get(video)
	if (!entry) return
	for (const [other, { manual }] of entries) if (manual && other !== video) other.pause()
	entry.manual = true
	video.loop = false
	video.muted = false
	video.controls = true
	void video.play().catch(() => {})
	pick()
}
