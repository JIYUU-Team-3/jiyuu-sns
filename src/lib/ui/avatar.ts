/** A stable hue per account, so someone without a photo always gets the same colour. */
export function avatar_hue(seed: string) {
	let hash = 0
	for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) | 0
	return Math.abs(hash) % 360
}

/** Up to two initials, e.g. `Mika Tanaka` → `MT`. */
export const initials = (name: string) =>
	name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((word) => [...word][0])
		.join('')
		.toUpperCase()
