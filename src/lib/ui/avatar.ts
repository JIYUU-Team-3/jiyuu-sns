/** A stable hue per account, so someone without a photo always gets the same colour. */
export function avatar_hue(seed: string) {
	// A 31-based string hash wrapped to 32 bits, as Java's String.hashCode, kept unsigned while it
	// runs and read as signed at the end, so the hues stay the ones accounts already have.
	let hash = 0
	for (const char of seed) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0
	const signed = hash >= 2 ** 31 ? hash - 2 ** 32 : hash
	return Math.abs(signed) % 360
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
