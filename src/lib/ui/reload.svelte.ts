/**
 * Lets a tap on something already showing (the home button, the active tab) reload the page's
 * pull-to-refresh content, the same way a pull would.
 */
let current: (() => void) | undefined

/** Called by the page's `PullToRefresh`; returns the cleanup. */
export function register_reload(run: () => void) {
	current = run
	return () => {
		if (current === run) current = undefined
	}
}

/** Reloads what's on screen. False when nothing here can reload, so the tap should go on as usual. */
export function reload() {
	if (!current) return false
	current()
	return true
}

/** Click handler for a link or tab that, while it is already current, reloads instead of navigating. */
export function reload_when(here: boolean) {
	return (event: MouseEvent) => {
		if (here && reload()) event.preventDefault()
	}
}
