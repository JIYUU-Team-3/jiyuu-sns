import { describe, expect, it } from 'vitest'
import {
	exif_orientation,
	MetadataError,
	strip_gif,
	strip_jpeg,
	strip_metadata,
	strip_png,
	strip_webp,
} from './strip-metadata'

const bytes = (...parts: (number[] | string)[]) =>
	new Uint8Array(
		parts.flatMap((part) =>
			typeof part === 'string' ? [...part].map((c) => c.charCodeAt(0)) : part,
		),
	)

const text = (data: Uint8Array) => String.fromCharCode(...data)

/** A JPEG segment: marker, big-endian length, body. */
function segment(marker: number, body: Uint8Array) {
	const length = body.length + 2
	return bytes([0xff, marker, length >> 8, length & 0xff], [...body])
}

/** Big-endian EXIF with orientation 6 and a GPS pointer, plus a "Canon" make string. */
const EXIF = bytes(
	'Exif\0\0',
	'MM',
	[0x00, 0x2a, 0x00, 0x00, 0x00, 0x08],
	[0x00, 0x02],
	[0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, 0x06, 0x00, 0x00],
	[0x88, 0x25, 0x00, 0x04, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x26],
	[0x00, 0x00, 0x00, 0x00],
	'GPS 11.55N 104.92E Canon',
)

function jpeg(exif = EXIF) {
	return bytes(
		[0xff, 0xd8],
		[...segment(0xe0, bytes('JFIF\0', [1, 1, 0, 0, 1, 0, 1, 0, 0]))],
		[...segment(0xe1, exif)],
		[...segment(0xe1, bytes('http://ns.adobe.com/xap/1.0/\0<x:xmpmeta>Jane</x:xmpmeta>'))],
		[...segment(0xe2, bytes('ICC_PROFILE\0', [1, 1, 9, 9]))],
		[...segment(0xfe, bytes('taken at home'))],
		[...segment(0xdb, bytes([0, 1, 2, 3]))],
		[...segment(0xda, bytes([0, 1, 2]))],
		[0x12, 0x34, 0xff, 0x00, 0x56, 0xff, 0xd9],
	)
}

describe('strip_jpeg', () => {
	const out = strip_jpeg(jpeg())

	it('drops EXIF, XMP and comments', () => {
		expect(text(out)).not.toContain('GPS')
		expect(text(out)).not.toContain('Canon')
		expect(text(out)).not.toContain('xmpmeta')
		expect(text(out)).not.toContain('taken at home')
	})

	it('keeps JFIF first, the colour profile, and the image data untouched', () => {
		expect(text(out.subarray(6, 10))).toBe('JFIF')
		expect(text(out)).toContain('ICC_PROFILE')
		expect([...out.subarray(-7)]).toEqual([0x12, 0x34, 0xff, 0x00, 0x56, 0xff, 0xd9])
	})

	it('keeps the orientation so photos stay upright', () => {
		const exif_at = text(out).indexOf('Exif\0\0')
		expect(exif_at).toBeGreaterThan(0)
		expect(exif_orientation(out.subarray(exif_at))).toBe(6)
	})

	it('adds no EXIF when the photo is already upright', () => {
		const plain = strip_jpeg(
			jpeg(bytes('Exif\0\0', 'MM', [0, 0x2a, 0, 0, 0, 8], [0, 0], [0, 0, 0, 0])),
		)
		expect(text(plain)).not.toContain('Exif')
	})

	it('refuses a broken file', () => {
		expect(() => strip_jpeg(bytes([0xff, 0xd8, 0x00, 0x00]))).toThrow(MetadataError)
	})
})

/** A PNG chunk; the CRC isn't checked here, so it's left zero. */
const chunk = (type: string, data: number[] | string = []) => {
	const body = typeof data === 'string' ? [...bytes(data)] : data
	return bytes([0, 0, body.length >> 8, body.length & 0xff], type, body, [0, 0, 0, 0])
}

describe('strip_png', () => {
	it('drops text, EXIF and time chunks and keeps the image', () => {
		const png = bytes(
			[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
			[...chunk('IHDR', [0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0])],
			[...chunk('tEXt', 'Author\0Jane Doe')],
			[...chunk('eXIf', 'MM GPS')],
			[...chunk('tIME', [7, 234, 9, 29, 12, 0, 0])],
			[...chunk('IDAT', [1, 2, 3])],
			[...chunk('IEND')],
		)
		const out = text(strip_png(png))
		expect(out).not.toContain('Jane')
		expect(out).not.toContain('GPS')
		expect(out).not.toContain('tIME')
		expect(out).toContain('IHDR')
		expect(out).toContain('IDAT')
		expect(out).toContain('IEND')
	})
})

const le32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff]
const riff_chunk = (type: string, data: number[]) =>
	bytes(type, le32(data.length), data, data.length % 2 ? [0] : [])

describe('strip_webp', () => {
	it('drops EXIF and XMP, clears their flags and fixes the size', () => {
		const body = bytes(
			'WEBP',
			[...riff_chunk('VP8X', [VP8X_FLAGS, 0, 0, 0, 0, 0, 0, 0, 0, 0])],
			[...riff_chunk('VP8 ', [1, 2, 3, 4])],
			[...riff_chunk('EXIF', [...bytes('GPS!!')])],
			[...riff_chunk('XMP ', [...bytes('<x>Jane</x>')])],
		)
		const webp = bytes('RIFF', le32(body.length), [...body])
		const out = strip_webp(webp)
		expect(text(out)).not.toContain('GPS')
		expect(text(out)).not.toContain('Jane')
		expect(out[20] & 0x0c).toBe(0)
		expect(new DataView(out.buffer).getUint32(4, true)).toBe(out.length - 8)
	})
})

/** VP8X flags with both EXIF (0x08) and XMP (0x04) set. */
const VP8X_FLAGS = 0x0c

describe('strip_gif', () => {
	it('drops comments and XMP but keeps looping and frames', () => {
		const gif = bytes(
			'GIF89a',
			[1, 0, 1, 0, 0x00, 0, 0],
			[0x21, 0xff, 11],
			'NETSCAPE2.0',
			[3, 1, 0, 0, 0],
			[0x21, 0xfe, 5],
			'hello',
			[0],
			[0x21, 0xff, 11],
			'XMP DataXMP',
			[4],
			'Jane',
			[0],
			[0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0x00, 2, 2, 0x4c, 0x01, 0],
			[0x3b],
		)
		const out = text(strip_gif(gif))
		expect(out).toContain('NETSCAPE2.0')
		expect(out).not.toContain('hello')
		expect(out).not.toContain('Jane')
		expect(out.endsWith(';')).toBe(true)
		expect(out).toContain(',')
	})
})

describe('strip_metadata', () => {
	it('refuses types it can’t clean', () => {
		expect(() => strip_metadata(new ArrayBuffer(4), 'image/svg+xml')).toThrow(MetadataError)
	})
})
