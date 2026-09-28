type Toast = {
	/** Bumped for every toast, so repeating the same message still restarts its entrance. */
	id: number
	message: string
	action?: { label: string; href: string }
}

const VISIBLE_MS = 3200

let current = $state<Toast | undefined>()
let next_id = 0
let timer: ReturnType<typeof setTimeout> | undefined

/** One toast at a time; a new one replaces the old. Only ever called from browser events. */
export const toast = {
	get current() {
		return current
	},
	show(message: string, action?: Toast['action']) {
		current = { id: next_id++, message, action }
		clearTimeout(timer)
		timer = setTimeout(() => (current = undefined), VISIBLE_MS)
	},
}
