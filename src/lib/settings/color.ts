/** OKLCH colours for the Daylight theme and the accent palettes, mapped into sRGB. */

function oklch_to_linear(lightness: number, chroma: number, hue: number) {
	const hr = (hue * Math.PI) / 180
	const a = chroma * Math.cos(hr)
	const b = chroma * Math.sin(hr)
	const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
	const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
	const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3
	return [
		4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
	]
}

const in_gamut = (rgb: number[]) => rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4)

/** Linear sRGB for an OKLCH colour, with chroma reduced until it fits. */
function to_linear(lightness: number, chroma: number, hue: number) {
	const lin = oklch_to_linear(lightness, chroma, hue)
	if (in_gamut(lin)) return lin
	let lo = 0
	let hi = chroma
	for (let k = 0; k < 16; k++) {
		const mid = (lo + hi) / 2
		if (in_gamut(oklch_to_linear(lightness, mid, hue))) lo = mid
		else hi = mid
	}
	return oklch_to_linear(lightness, lo, hue).map((v) => Math.min(1, Math.max(0, v)))
}

const gamma = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)

/** `rgb(r g b)` or `rgb(r g b / alpha)` for an OKLCH colour. */
export function col(lightness: number, chroma: number, hue: number, alpha?: number) {
	const [r, g, b] = to_linear(lightness, chroma, hue).map((v) => Math.round(gamma(v) * 255))
	return alpha == null ? `rgb(${r} ${g} ${b})` : `rgb(${r} ${g} ${b} / ${alpha})`
}

/** WCAG relative luminance of an opaque `rgb(r g b)` or `#rrggbb` colour. */
export function luminance(color: string) {
	const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color)
	const parts = hex
		? hex.slice(1).map((h) => parseInt(h, 16))
		: (color.match(/\d+/g) ?? []).slice(0, 3).map(Number)
	const [r, g, b] = parts.map((v) => {
		const c = v / 255
		return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
	})
	return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast ratio between two opaque colours. */
export function contrast(a: string, b: string) {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
	return (hi + 0.05) / (lo + 0.05)
}
