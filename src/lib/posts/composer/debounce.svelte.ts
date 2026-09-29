/** Follows `read()` once it has stopped changing for `ms`, so typing doesn't fire a search per key. */
export function debounced<T>(read: () => T, ms = 300) {
	let value = $state(read())
	$effect(() => {
		const next = read()
		const timer = setTimeout(() => (value = next), ms)
		return () => clearTimeout(timer)
	})
	return {
		get current() {
			return value
		},
	}
}
