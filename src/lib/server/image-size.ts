/** Width and height from an image's header, without decoding it; undefined when it can't tell. */
export function image_size(bytes: Uint8Array, type: string) {
	const size = HEADERS[type]?.(bytes)
	return size && size.width > 0 && size.height > 0 ? size : undefined
}

type Size = { width: number; height: number }

const u16be = (b: Uint8Array, at: number) => (b[at] << 8) | b[at + 1]
const u16le = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8)
const u24le = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8) | (b[at + 2] << 16)
const u32be = (b: Uint8Array, at: number) =>
	((b[at] << 24) | (b[at + 1] << 16) | u16be(b, at + 2)) >>> 0
const tag = (b: Uint8Array, at: number) => String.fromCharCode(...b.subarray(at, at + 4))

/** Start-of-frame markers, which hold the size; C4, C8 and CC are other tables. */
const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf])

function jpeg(b: Uint8Array): Size | undefined {
	let at = 2
	while (at + 9 < b.length) {
		if (b[at] !== 0xff) return undefined
		const marker = b[at + 1]
		// Fill bytes before a marker, and markers that carry no length.
		if (marker === 0xff) {
			at += 1
			continue
		}
		if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
			at += 2
			continue
		}
		if (SOF.has(marker)) return { height: u16be(b, at + 5), width: u16be(b, at + 7) }
		at += 2 + u16be(b, at + 2)
	}
	return undefined
}

const HEADERS: Record<string, (b: Uint8Array) => Size | undefined> = {
	'image/jpeg': jpeg,
	'image/png': (b) =>
		b.length >= 24 && tag(b, 12) === 'IHDR'
			? { width: u32be(b, 16), height: u32be(b, 20) }
			: undefined,
	'image/gif': (b) => (b.length >= 10 ? { width: u16le(b, 6), height: u16le(b, 8) } : undefined),
	'image/webp': (b) => {
		if (b.length < 30) return undefined
		const chunk = tag(b, 12)
		if (chunk === 'VP8 ') return { width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff }
		if (chunk === 'VP8L')
			return {
				width: 1 + (((b[22] & 0x3f) << 8) | b[21]),
				height: 1 + (((b[24] & 0x0f) << 10) | (b[23] << 2) | ((b[22] & 0xc0) >> 6)),
			}
		if (chunk === 'VP8X') return { width: 1 + u24le(b, 24), height: 1 + u24le(b, 27) }
		return undefined
	},
}
