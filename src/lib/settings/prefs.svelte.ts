import { browser } from '$app/env'
import { page } from '$app/state'
import { accent_css } from './accents'
import { DAY_VARS } from './daylight'
import { FADE_MS, fade } from './fade'
import {
	COOKIE_MAX_AGE,
	DEFAULT_PREFS,
	PREFS_COOKIE,
	TZ_COOKIE,
	daylight_vars,
	serialize_prefs,
	type Prefs,
} from './prefs'

const write_cookie = (name: string, value: string) => {
	document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`
}

const now_minutes = () => {
	const d = new Date()
	return d.getHours() * 60 + d.getMinutes()
}

/**
 * The device's display preferences. The server paints them into the first HTML from the cookie;
 * after that this keeps the root element, the cookie and Daylight's clock in step.
 */
class DisplayPrefs {
	#value = $state<Prefs>(DEFAULT_PREFS)
	/** The local time, in minutes after midnight, as of Daylight's last tick. */
	#now = $state(now_minutes())
	#timer: ReturnType<typeof setInterval> | undefined
	/** Transparent mode, turned off, still showing while the page fades back in under it. */
	#clear_leaving = $state(false)
	#clear_timer: ReturnType<typeof setTimeout> | undefined

	/** The current preferences; during SSR, the ones the request's cookie carried. */
	get value(): Prefs {
		return browser ? this.#value : (page.data.prefs ?? DEFAULT_PREFS)
	}

	/** Whether the page shows transparent mode right now, including while it fades away. */
	get clear_shown() {
		return this.value.clear || this.#clear_leaving
	}

	/** Minutes after midnight that Daylight is painting. */
	get minutes() {
		return this.#now
	}

	/** Start from what the server rendered. Runs once, on the first load. */
	init(prefs: Prefs) {
		this.#value = prefs
		// Refreshed each visit: travel and daylight saving both move it.
		write_cookie(TZ_COOKIE, String(new Date().getTimezoneOffset()))
		this.#run_daylight()
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'visible') this.#tick()
		})
		// The device switching between light and dark fades too, while the theme follows it.
		matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
			if (this.#value.theme === 'system') fade(() => {})
		})
	}

	set<K extends keyof Prefs>(key: K, value: Prefs[K]) {
		this.#value = { ...this.#value, [key]: value }
		write_cookie(PREFS_COOKIE, serialize_prefs(this.#value))
		fade(() => this.#apply(), key === 'clear' ? 'clear' : 'theme')
	}

	#apply() {
		const root = document.documentElement
		const { theme, accent, clear, reduce_motion } = this.#value
		set_attr(root, 'data-theme', theme === 'system' ? null : theme)
		set_attr(root, 'data-accent', accent === 'blue' ? null : accent)
		set_attr(root, 'data-motion', reduce_motion ? 'reduce' : null)
		this.#apply_clear(clear)
		this.#run_daylight()
	}

	/**
	 * Turning transparent mode on clears the sticky bars at once while the page and its greys
	 * fade beneath them. Turning it off runs the other way round: everything fades back in
	 * (`data-clear-leaving`) under bars that stay clear until the page is opaque again.
	 */
	#apply_clear(clear: boolean) {
		const root = document.documentElement
		clearTimeout(this.#clear_timer)
		const fading = root.hasAttribute('data-theme-fade')
		this.#clear_leaving = !clear && fading && root.hasAttribute('data-clear')
		root.toggleAttribute('data-clear', clear || this.#clear_leaving)
		root.toggleAttribute('data-clear-leaving', this.#clear_leaving)
		if (this.#clear_leaving) this.#clear_timer = setTimeout(() => this.#finish_clear(), FADE_MS)
	}

	#finish_clear() {
		this.#clear_leaving = false
		document.documentElement.removeAttribute('data-clear')
		document.documentElement.removeAttribute('data-clear-leaving')
	}

	#run_daylight() {
		clearInterval(this.#timer)
		this.#paint_daylight()
		if (this.#value.theme === 'daylight') {
			this.#timer = setInterval(() => this.#tick(), 60_000)
		}
	}

	/** Daylight's clock: small drifts paint at once, a flip between light and dark cross-fades. */
	#tick() {
		if (this.#value.theme !== 'daylight') return
		const scheme = daylight_vars(now_minutes(), this.#value.accent)['color-scheme']
		const flips = scheme !== document.documentElement.style.getPropertyValue('color-scheme')
		if (flips) fade(() => this.#paint_daylight())
		else this.#paint_daylight()
	}

	/** Paint Daylight for the time now, or clear it under the other themes. */
	#paint_daylight() {
		this.#now = now_minutes()
		const style = document.documentElement.style
		if (this.#value.theme !== 'daylight') {
			for (const name of DAY_VARS) style.removeProperty(name)
			style.removeProperty('color-scheme')
			return
		}
		for (const [name, value] of Object.entries(daylight_vars(this.#now, this.#value.accent))) {
			style.setProperty(name, value)
		}
	}
}

function set_attr(el: Element, name: string, value: string | null) {
	if (value === null) el.removeAttribute(name)
	else el.setAttribute(name, value)
}

export const prefs = new DisplayPrefs()

/** The `<style>` for the chosen accent, for the root layout's head. */
export const accent_style = () => {
	const css = accent_css(prefs.value.accent)
	return css && `<style id="accent">${css}</style>`
}
