import { describe, expect, it } from 'vitest'
import { MetadataError } from './strip-metadata'
import { strip_video } from './strip-video'

const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0))
const u32 = (n: number) => [n >>> 24, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]

/** A box: 32-bit size, type, then its body. */
const box = (type: string, ...body: number[][]) => {
	const flat = body.flat()
	return [...u32(flat.length + 8), ...ascii(type), ...flat]
}

/** A version-0 `mvhd`: dates, then timescale 1000 and `ms` of duration. */
const mvhd = (ms: number) =>
	box('mvhd', [0, 0, 0, 0], u32(0x11111111), u32(0x22222222), u32(1000), u32(ms), Array(80).fill(0))

const hdlr = (kind: string) => box('hdlr', [0, 0, 0, 0], u32(0), ascii(kind), Array(12).fill(0))
const trak = (kind: string) => box('trak', box('mdia', hdlr(kind)))
const GPS = box('udta', box('©xyz', ascii('+11.55+104.92/')))

function mp4(ms = 5000, extra: number[] = []) {
	return new Blob([
		new Uint8Array([
			...box('ftyp', ascii('isom'), u32(0)),
			...box('moov', mvhd(ms), trak('vide'), trak('meta'), GPS),
			...extra,
			...box('mdat', ascii('frames')),
		]),
	])
}

const text = async (blob: Blob) => String.fromCharCode(...new Uint8Array(await blob.arrayBuffer()))

describe('strip_video', () => {
	it('removes location and timed-metadata tracks without moving anything', async () => {
		const file = mp4()
		const { video, seconds } = await strip_video(file)
		const out = await text(video)
		expect(video.size).toBe(file.size)
		expect(out).not.toContain('+11.55')
		expect(out).not.toContain('udta')
		expect(out).not.toMatch(/hdlr.{8}meta/s)
		expect(out).toContain('vide')
		expect(out.endsWith('mdatframes')).toBe(true)
		expect(seconds).toBe(5)
	})

	it('clears the creation and modification dates', async () => {
		const out = new Uint8Array(await (await strip_video(mp4())).video.arrayBuffer())
		expect(out.join()).not.toContain([0x11, 0x11, 0x11, 0x11].join())
		expect(out.join()).not.toContain([0x22, 0x22, 0x22, 0x22].join())
	})

	it('blanks unknown top-level boxes such as XMP', async () => {
		const { video } = await strip_video(mp4(5000, box('uuid', ascii('<x:xmpmeta GPS/>'))))
		expect(await text(video)).not.toContain('xmpmeta')
	})

	it.each(['meta', 'text', 'sbtl', 'tmcd'])(
		'zeroes the samples of a %s track inside mdat',
		async (kind) => {
			// ftyp is 16 bytes and mdat's header 8, so the GPS sample starts at 16 + 8 + 6 = 30.
			const stbl = box(
				'stbl',
				box('stsz', [0, 0, 0, 0], u32(0), u32(1), u32(8)),
				box('stsc', [0, 0, 0, 0], u32(1), u32(1), u32(1), u32(1)),
				box('stco', [0, 0, 0, 0], u32(1), u32(30)),
			)
			const gps_track = box('trak', box('mdia', hdlr(kind), box('minf', stbl)))
			const file = new Blob([
				new Uint8Array([
					...box('ftyp', ascii('isom'), u32(0)),
					...box('mdat', ascii('framesGPS12345after')),
					...box('moov', mvhd(1000), trak('vide'), gps_track),
				]),
			])
			const { video } = await strip_video(file)
			const out = await text(video)
			expect(video.size).toBe(file.size)
			expect(out).not.toContain('GPS12345')
			expect(out).toContain('frames\0\0\0\0\0\0\0\0after')
		},
	)

	it('zeroes padding, which can hold leftover metadata', async () => {
		const leftover = box('free', ascii('GPS12345'))
		const file = new Blob([
			new Uint8Array([
				...box('ftyp', ascii('isom'), u32(0)),
				...box('moov', mvhd(1000), leftover),
				...box('skip', ascii('GPS12345')),
				...box('mdat', ascii('frames')),
			]),
		])
		const { video } = await strip_video(file)
		expect(video.size).toBe(file.size)
		expect(await text(video)).not.toContain('GPS12345')
	})

	it('refuses compact sample sizes, which it cannot map to zero', async () => {
		const stbl = box('stbl', box('stz2', [0, 0, 0, 0], u32(8), u32(0)))
		const file = new Blob([
			new Uint8Array([
				...box('ftyp', ascii('isom'), u32(0)),
				...box('moov', mvhd(1000), box('trak', box('mdia', hdlr('meta'), box('minf', stbl)))),
				...box('mdat', ascii('frames')),
			]),
		])
		await expect(strip_video(file)).rejects.toThrow(MetadataError)
	})

	it('takes the longest track, not just the movie header', async () => {
		// A version-0 tkhd (duration at 20, in the movie's timescale) and mdhd (timescale 600).
		const tkhd = box(
			'tkhd',
			[0, 0, 0, 0],
			u32(0),
			u32(0),
			u32(1),
			u32(0),
			u32(600_000),
			Array(60).fill(0),
		)
		const mdhd = box('mdhd', [0, 0, 0, 0], u32(0), u32(0), u32(600), u32(600 * 300), u32(0))
		const file = new Blob([
			new Uint8Array([
				...box('ftyp', ascii('isom'), u32(0)),
				...box('moov', mvhd(1000), box('trak', tkhd, box('mdia', mdhd, hdlr('vide')))),
				...box('mdat', ascii('frames')),
			]),
		])
		expect((await strip_video(file)).seconds).toBe(600)
	})

	it('refuses fragmented files, whose samples are indexed outside moov', async () => {
		const fragmented = new Blob([
			new Uint8Array([
				...box('ftyp', ascii('isom'), u32(0)),
				...box('moov', mvhd(0)),
				...box('moof', box('mfhd', u32(0), u32(1))),
				...box('mdat', ascii('frames')),
			]),
		])
		await expect(strip_video(fragmented)).rejects.toThrow(MetadataError)
	})

	it('reports the length for the duration limit', async () => {
		expect((await strip_video(mp4(141_500))).seconds).toBe(141.5)
	})

	it('refuses files it cannot parse', async () => {
		await expect(
			strip_video(new Blob([new Uint8Array(box('ftyp', ascii('isom')))])),
		).rejects.toThrow(MetadataError)
		const broken = new Uint8Array([...box('ftyp', ascii('isom')), ...u32(9999), ...ascii('moov')])
		await expect(strip_video(new Blob([broken]))).rejects.toThrow(MetadataError)
	})
})
