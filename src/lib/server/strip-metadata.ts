/*
 * Uploaded images can carry metadata the uploader never sees: where a photo was taken (EXIF
 * GPS), the camera and its serial number, editing software, names and comments. These strip it
 * by copying the file's structure without those parts, so the pixels are never re-encoded.
 */

export class MetadataError extends Error {}

const fail = (why: string): never => {
	throw new MetadataError(why)
}

function concat(parts: Uint8Array[]) {
	const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
	let at = 0
	for (const part of parts) {
		out.set(part, at)
		at += part.length
	}
	return out
}

const ascii = (bytes: Uint8Array, at: number, length: number) =>
	String.fromCharCode(...bytes.subarray(at, at + length))

// ---------- JPEG ----------

/** The EXIF orientation (1–8), which says how to turn the photo upright; 1 when there's none. */
export function exif_orientation(segment: Uint8Array): number {
	// segment: "Exif\0\0" then a TIFF block.
	if (ascii(segment, 0, 6) !== 'Exif\0\0') return 1
	const tiff = new DataView(segment.buffer, segment.byteOffset + 6, segment.length - 6)
	if (tiff.byteLength < 8) return 1
	const little = tiff.getUint16(0) === 0x4949
	const ifd = tiff.getUint32(4, little)
	if (ifd + 2 > tiff.byteLength) return 1
	const count = tiff.getUint16(ifd, little)
	for (let i = 0; i < count; i++) {
		const entry = ifd + 2 + i * 12
		if (entry + 12 > tiff.byteLength) return 1
		if (tiff.getUint16(entry, little) === 0x0112) {
			const value = tiff.getUint16(entry + 8, little)
			return value >= 1 && value <= 8 ? value : 1
		}
	}
	return 1
}

/** A minimal EXIF segment holding only the orientation, so phone photos still show upright. */
function orientation_segment(orientation: number) {
	const tiff = [
		...[0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08], // big-endian TIFF, IFD at 8
		...[0x00, 0x01], // one entry
		...[0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, orientation, 0x00, 0x00],
		...[0x00, 0x00, 0x00, 0x00], // no next IFD
	]
	const body = [...'Exif\0\0'].map((c) => c.charCodeAt(0)).concat(tiff)
	const length = body.length + 2
	return new Uint8Array([0xff, 0xe1, length >> 8, length & 0xff, ...body])
}

/** APP1 (EXIF, XMP), APP12 (camera info), APP13 (Photoshop/IPTC) and comments go. */
const JPEG_DROPPED = new Set([0xe1, 0xec, 0xed, 0xfe])

const SOS = 0xda
const EOI = 0xd9

/** Markers with no length after them: TEM and the restart markers. */
const standalone = (marker: number) => marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)

/** APP2 also carries the MPF index of extra pictures after the image, which are dropped. */
const is_mpf = (segment: Uint8Array) => segment[1] === 0xe2 && ascii(segment, 4, 4) === 'MPF\0'

/**
 * Where a scan's entropy-coded data ends: the next marker that isn't stuffing (FF 00), a restart
 * (FF D0–D7) or fill (FF FF). The end of the file when there's none.
 */
function scan_end(bytes: Uint8Array, at: number) {
	for (; at + 1 < bytes.length; at++) {
		if (bytes[at] !== 0xff) continue
		const next = bytes[at + 1]
		if (next !== 0x00 && next !== 0xff && !(next >= 0xd0 && next <= 0xd7)) return at
	}
	return bytes.length
}

function segment_end(bytes: Uint8Array, at: number) {
	if (at + 4 > bytes.length) fail('truncated')
	const length = (bytes[at + 2] << 8) | bytes[at + 3]
	const end = at + 2 + length
	if (length < 2 || end > bytes.length) fail('bad segment length')
	return end
}

/** Puts the orientation near the start, where readers look for EXIF: after JFIF if it's there. */
function add_orientation(kept: Uint8Array[], orientation: number) {
	if (orientation === 1) return
	const after_jfif = kept[1]?.[1] === 0xe0 ? 2 : 1
	kept.splice(after_jfif, 0, orientation_segment(orientation))
}

/**
 * Walks every segment up to the end of the image, including the ones between the scans of a
 * progressive JPEG, and drops anything after it (motion photo videos, extra pictures, trailers).
 */
export function strip_jpeg(bytes: Uint8Array): Uint8Array {
	if (bytes[0] !== 0xff || bytes[1] !== 0xd8) fail('not a JPEG')
	const kept: Uint8Array[] = [bytes.subarray(0, 2)]
	let orientation = 1
	let at = 2
	while (at < bytes.length) {
		if (bytes[at] !== 0xff) fail('bad marker')
		const marker = bytes[at + 1]
		if (marker === 0xff) {
			at++ // fill byte
			continue
		}
		if (marker === EOI) {
			kept.push(bytes.subarray(at, at + 2))
			break
		}
		if (standalone(marker)) {
			kept.push(bytes.subarray(at, at + 2))
			at += 2
			continue
		}
		const end = segment_end(bytes, at)
		const segment = bytes.subarray(at, end)
		if (marker === 0xe1) orientation = Math.max(orientation, exif_orientation(segment.subarray(4)))
		if (!JPEG_DROPPED.has(marker) && !is_mpf(segment)) kept.push(segment)
		at = end
		if (marker === SOS) {
			const data_end = scan_end(bytes, at)
			kept.push(bytes.subarray(at, data_end))
			at = data_end
		}
	}
	add_orientation(kept, orientation)
	return concat(kept)
}

// ---------- PNG ----------

/** Text chunks, embedded EXIF and the last-modified time. */
const PNG_DROPPED = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME'])

export function strip_png(bytes: Uint8Array): Uint8Array {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
	const kept: Uint8Array[] = [bytes.subarray(0, 8)]
	let at = 8
	while (at < bytes.length) {
		if (at + 12 > bytes.length) fail('truncated')
		const length = view.getUint32(at)
		const type = ascii(bytes, at + 4, 4)
		const end = at + 12 + length
		if (end > bytes.length) fail('bad chunk length')
		if (!PNG_DROPPED.has(type)) kept.push(bytes.subarray(at, end))
		at = end
		if (type === 'IEND') break
	}
	return concat(kept)
}

// ---------- WebP ----------

const VP8X_EXIF = 0x08
const VP8X_XMP = 0x04

/** The chunks an image is drawn from; any other (EXIF, XMP, unknown ones) goes. */
const WEBP_KEPT = new Set(['VP8 ', 'VP8L', 'VP8X', 'ALPH', 'ANIM', 'ANMF', 'ICCP'])
/** The chunks inside an animation frame, after its 16-byte header. */
const FRAME_KEPT = new Set(['ALPH', 'VP8 ', 'VP8L'])

function riff_chunk(type: string, body: Uint8Array) {
	const chunk = new Uint8Array(8 + body.length + (body.length % 2))
	chunk.set([...type].map((c) => c.charCodeAt(0)))
	new DataView(chunk.buffer).setUint32(4, body.length, true)
	chunk.set(body, 8)
	return chunk
}

/** The chunks between `from` and `to` whose type is in `kept`, cleaned. */
function webp_chunks(bytes: Uint8Array, from: number, to: number, kept: Set<string>) {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
	const out: Uint8Array[] = []
	let at = from
	while (at + 8 <= to) {
		const type = ascii(bytes, at, 4)
		const size = view.getUint32(at + 4, true)
		// Chunks are padded to an even length.
		const end = at + 8 + size + (size % 2)
		if (end > to) fail('bad chunk length')
		if (kept.has(type)) out.push(clean_chunk(bytes, at, end, type))
		at = end
	}
	return out
}

function clean_chunk(bytes: Uint8Array, at: number, end: number, type: string) {
	if (type === 'VP8X') {
		const chunk = bytes.slice(at, end)
		chunk[8] &= ~(VP8X_EXIF | VP8X_XMP)
		return chunk
	}
	if (type === 'ANMF') {
		if (at + 24 > end) fail('short frame')
		const frames = webp_chunks(bytes, at + 24, end, FRAME_KEPT)
		return riff_chunk('ANMF', concat([bytes.subarray(at + 8, at + 24), ...frames]))
	}
	return bytes.subarray(at, end)
}

/** Keeps only what draws the image, up to the end the RIFF header gives; nothing after it. */
export function strip_webp(bytes: Uint8Array): Uint8Array {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
	if (ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP') fail('not a WebP')
	const riff_end = 8 + view.getUint32(4, true)
	if (riff_end > bytes.length) fail('truncated')
	const body = concat(webp_chunks(bytes, 12, riff_end, WEBP_KEPT))
	const header = new Uint8Array(12)
	header.set(bytes.subarray(0, 12))
	new DataView(header.buffer).setUint32(4, body.length + 4, true)
	return concat([header, body])
}

// ---------- GIF ----------

/** Application extensions that only control animation; any other (such as XMP) goes. */
const GIF_KEPT_APPS = new Set(['NETSCAPE2.0', 'ANIMEXTS1.0'])

/** Where a run of GIF sub-blocks ends (after its zero-length terminator). */
function sub_blocks_end(bytes: Uint8Array, at: number) {
	while (at < bytes.length) {
		const size = bytes[at]
		at += 1 + size
		if (size === 0) return at
	}
	return fail('truncated sub-blocks')
}

const color_table_size = (flags: number) => (flags & 0x80 ? 3 * 2 ** ((flags & 0x07) + 1) : 0)

export function strip_gif(bytes: Uint8Array): Uint8Array {
	if (ascii(bytes, 0, 3) !== 'GIF') fail('not a GIF')
	let at = 13 + color_table_size(bytes[10])
	const kept: Uint8Array[] = [bytes.subarray(0, at)]
	while (at < bytes.length) {
		const start = at
		const block = bytes[at]
		if (block === 0x3b) {
			kept.push(bytes.subarray(at, at + 1))
			break
		}
		if (block === 0x2c) {
			// Image descriptor, local colour table, LZW code size, then data sub-blocks.
			at += 10 + color_table_size(bytes[at + 9]) + 1
			at = sub_blocks_end(bytes, at)
			kept.push(bytes.subarray(start, at))
		} else if (block === 0x21) {
			const label = bytes[at + 1]
			const app = label === 0xff ? ascii(bytes, at + 3, 11) : ''
			at = sub_blocks_end(bytes, at + 2)
			const drop = label === 0xfe || (label === 0xff && !GIF_KEPT_APPS.has(app))
			if (!drop) kept.push(bytes.subarray(start, at))
		} else {
			fail('bad block')
		}
	}
	return concat(kept)
}

// ---------- Any ----------

const STRIPPERS: Record<string, (bytes: Uint8Array) => Uint8Array> = {
	'image/jpeg': strip_jpeg,
	'image/png': strip_png,
	'image/webp': strip_webp,
	'image/gif': strip_gif,
}

/**
 * The image without its metadata. Throws `MetadataError` when the file can't be read, so an
 * image is never stored with its metadata still in it.
 */
export function strip_metadata(bytes: ArrayBuffer, type: string): ArrayBuffer {
	const strip = STRIPPERS[type] ?? fail(`unsupported type ${type}`)
	const out = strip(new Uint8Array(bytes))
	return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer
}
