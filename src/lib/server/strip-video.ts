/*
 * Videos carry the same kind of hidden metadata as photos: where they were shot (Apple's
 * `com.apple.quicktime.location.ISO6709`, `©xyz`), the phone's make and model, software, dates,
 * XMP. MP4 and QuickTime files are trees of boxes; those live in `udta`, `meta` and `uuid` boxes,
 * in leftover padding, and in tracks that aren't played (per-frame GPS, a drone's subtitles).
 * Each such box is turned into a `free` box of the same size, its contents zeroed, and such a
 * track's samples are zeroed inside `mdat` too, so every other box stays where it was and the
 * sample offsets in `stco`/`co64` stay valid. The frames are never re-encoded, and only the
 * header boxes are read into memory.
 * Fragmented files (`moof`) are refused: their samples are indexed outside `moov`.
 */

import { MetadataError } from './strip-metadata'

const fail = (why: string): never => {
	throw new MetadataError(why)
}

type Box = { type: string; start: number; header: number; size: number }

/** Bytes of the file to zero, from `start` up to `end`. */
type Span = { start: number; end: number }

/** Top-level boxes kept as they are; any other, padding included, is blanked. */
const KEPT_TOP = new Set(['ftyp', 'moov', 'mdat', 'pdin'])
/**
 * Boxes blanked at any depth inside `moov`: metadata, and padding, which editors leave old
 * metadata in.
 */
const METADATA = new Set(['udta', 'meta', 'uuid', 'XMP_', 'free', 'skip', 'wide'])
/** Tracks that are played; any other (GPS, subtitles such as a drone's, timecode) is blanked. */
const PLAYED = new Set(['vide', 'soun'])
/** Boxes inside `moov` whose children are searched too. */
const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts', 'dinf'])
/** Full boxes that start with a creation and a modification time. */
const DATED = new Set(['mvhd', 'tkhd', 'mdhd'])
/** A header box is read whole; a real one is well under this. */
const HEADER_MAX = 16 * 1024 * 1024
const MAX_BOXES = 10_000
/** Far past 2:20 at any frame rate; a bigger count is a broken or hostile file. */
const MAX_SAMPLES = 1_000_000

const type_at = (view: DataView, at: number) =>
	String.fromCharCode(...new Uint8Array(view.buffer, view.byteOffset + at, 4))

/** The box starting at `at`, which may run for at most `room` bytes. */
function read_box(view: DataView, at: number, room: number): Box {
	if (room < 8 || at + 8 > view.byteLength) fail('truncated box')
	let size = view.getUint32(at)
	let header = 8
	if (size === 1) {
		if (room < 16 || at + 16 > view.byteLength) fail('truncated box')
		size = Number(view.getBigUint64(at + 8))
		header = 16
	} else if (size === 0) {
		size = room
	}
	if (size < header || size > room) fail('bad box size')
	return { type: type_at(view, at + 4), start: at, header, size }
}

/** The boxes packed between `from` and `to`. */
function children(view: DataView, from: number, to: number): Box[] {
	const boxes: Box[] = []
	for (let at = from; at < to; at += boxes[boxes.length - 1].size) {
		if (boxes.length > MAX_BOXES) fail('too many boxes')
		boxes.push(read_box(view, at, to - at))
	}
	return boxes
}

const body = (box: Box) => [box.start + box.header, box.start + box.size] as const

/** Turn a box into `free` padding: same size, type renamed, contents zeroed. */
function blank(bytes: Uint8Array, box: Box) {
	bytes.set([0x66, 0x72, 0x65, 0x65], box.start + 4) // "free"
	bytes.fill(0, ...body(box))
}

/** Zero a full box's creation and modification times; version 1 stores them in 64 bits. */
function clear_dates(view: DataView, bytes: Uint8Array, box: Box) {
	const [from, to] = body(box)
	const length = view.getUint8(from) === 1 ? 16 : 8
	if (from + 4 + length > to) fail('short dated box')
	bytes.fill(0, from + 4, from + 4 + length)
}

/** A track's handler, such as `vide`, `soun` or `meta`, from `trak/mdia/hdlr`. */
function handler(view: DataView, trak: Box) {
	const mdia = children(view, ...body(trak)).find((box) => box.type === 'mdia')
	const hdlr = mdia && children(view, ...body(mdia)).find((box) => box.type === 'hdlr')
	if (!hdlr) return undefined
	const [from, to] = body(hdlr)
	return from + 12 <= to ? type_at(view, from + 8) : undefined
}

const child = (view: DataView, parent: Box | undefined, type: string) =>
	parent && children(view, ...body(parent)).find((box) => box.type === type)

/**
 * A sample table's entries: the count sits `skip` bytes into the body, the entries of `width`
 * bytes follow, and `read` turns the one at each position into a value.
 */
function table<T>(view: DataView, box: Box, skip: number, width: number, read: (at: number) => T) {
	const [from, to] = body(box)
	if (from + skip + 4 > to) fail('short table')
	const count = view.getUint32(from + skip)
	const first = from + skip + 4
	if (first + count * width > to) fail('short table')
	return Array.from({ length: count }, (_, i) => read(first + i * width))
}

const u32 = (view: DataView) => (at: number) => view.getUint32(at)
const u64 = (view: DataView) => (at: number) => Number(view.getBigUint64(at))

/** Every sample's size, from `stsz`: one size for all, or one each. */
function sample_sizes(view: DataView, stsz: Box) {
	const [from] = body(stsz)
	const size = view.getUint32(from + 4)
	if (!size) return table(view, stsz, 8, 4, u32(view))
	const count = view.getUint32(from + 8)
	if (count > MAX_SAMPLES) fail('too many samples')
	return Array<number>(count).fill(size)
}

/** Where a track's samples sit in the file, chunk by chunk, from its sample table. */
function track_spans(view: DataView, trak: Box): Span[] {
	const stbl = child(view, child(view, child(view, trak, 'mdia'), 'minf'), 'stbl')
	if (child(view, stbl, 'stz2')) fail('compact sample sizes')
	const stsz = child(view, stbl, 'stsz')
	const stsc = child(view, stbl, 'stsc')
	const stco = child(view, stbl, 'stco') ?? child(view, stbl, 'co64')
	if (!stsz || !stsc || !stco) return []
	const sizes = sample_sizes(view, stsz)
	const offsets =
		stco.type === 'co64' ? table(view, stco, 4, 8, u64(view)) : table(view, stco, 4, 4, u32(view))
	// Runs of chunks: from which chunk (counting from 1), how many samples each holds.
	const runs = table(view, stsc, 4, 12, (at) => ({
		first: view.getUint32(at),
		per_chunk: view.getUint32(at + 4),
	}))
	let sample = 0
	let run = -1
	return offsets.map((start, i) => {
		while (run + 1 < runs.length && runs[run + 1].first <= i + 1) run++
		const per_chunk = runs[run]?.per_chunk ?? 0
		const length = sizes.slice(sample, sample + per_chunk).reduce((sum, n) => sum + n, 0)
		sample += per_chunk
		return { start, end: start + length }
	})
}

/**
 * Blank every metadata box and every track that isn't played under `parent`, and clear dates.
 * The blanked tracks' samples go in `spans`, to be zeroed where they sit in `mdat`.
 */
function scrub(view: DataView, bytes: Uint8Array, parent: Box, spans: Span[]) {
	for (const box of children(view, ...body(parent))) {
		if (METADATA.has(box.type)) blank(bytes, box)
		else if (box.type === 'trak' && !PLAYED.has(handler(view, box) ?? '')) {
			spans.push(...track_spans(view, box))
			blank(bytes, box)
		} else if (DATED.has(box.type)) clear_dates(view, bytes, box)
		else if (CONTAINERS.has(box.type)) scrub(view, bytes, box, spans)
	}
}

/** A duration and its timescale, from `mvhd` or `mdhd` (same layout after the dates). */
function timed(view: DataView, box: Box) {
	const [from, to] = body(box)
	const v1 = view.getUint8(from) === 1
	const at = from + (v1 ? 20 : 12)
	if (at + (v1 ? 12 : 8) > to) fail(`short ${box.type}`)
	const timescale = view.getUint32(at)
	const duration = v1 ? Number(view.getBigUint64(at + 4)) : view.getUint32(at + 4)
	return { timescale: timescale || fail('no timescale'), duration }
}

/** A track's duration from `tkhd`, in the movie's timescale. */
function track_duration(view: DataView, tkhd: Box) {
	const [from, to] = body(tkhd)
	const v1 = view.getUint8(from) === 1
	const at = from + (v1 ? 28 : 20)
	if (at + (v1 ? 8 : 4) > to) fail('short tkhd')
	return v1 ? Number(view.getBigUint64(at)) : view.getUint32(at)
}

/**
 * The movie's length in seconds: the longest of what `mvhd` and each played track's `tkhd` and
 * `mdhd` say, so a short `mvhd` can't sneak a long video past the limit. Run after `scrub`, when
 * only played tracks are left.
 */
function movie_seconds(view: DataView, moov: Box) {
	const movie = timed(view, child(view, moov, 'mvhd') ?? fail('no mvhd'))
	const lengths = [movie.duration / movie.timescale]
	for (const trak of children(view, ...body(moov)).filter((box) => box.type === 'trak')) {
		const tkhd = child(view, trak, 'tkhd')
		const mdhd = child(view, child(view, trak, 'mdia'), 'mdhd')
		if (tkhd) lengths.push(track_duration(view, tkhd) / movie.timescale)
		if (mdhd) {
			const media = timed(view, mdhd)
			lengths.push(media.duration / media.timescale)
		}
	}
	return Math.max(...lengths)
}

/** The file's top-level boxes, reading only their headers. */
async function top_level(file: Blob): Promise<Box[]> {
	const boxes: Box[] = []
	for (let at = 0; at < file.size; at += boxes[boxes.length - 1].size) {
		if (boxes.length > MAX_BOXES) fail('too many boxes')
		const view = new DataView(await file.slice(at, at + 16).arrayBuffer())
		boxes.push({ ...read_box(view, 0, file.size - at), start: at })
	}
	return boxes
}

/** A header box read into memory, with positions relative to it. */
async function load(file: Blob, box: Box) {
	if (box.size > HEADER_MAX) fail('header box too big')
	const bytes = new Uint8Array(await file.slice(box.start, box.start + box.size).arrayBuffer())
	const view = new DataView(bytes.buffer)
	return { bytes, view, box: { ...box, start: 0 } }
}

/** A blank `free` box standing in for `box`, so nothing after it moves. */
function padding(box: Box) {
	if (box.size > HEADER_MAX) fail('unknown box too big')
	const bytes = new Uint8Array(box.size)
	const view = new DataView(bytes.buffer)
	if (box.header === 16) {
		view.setUint32(0, 1)
		view.setBigUint64(8, BigInt(box.size))
	} else {
		view.setUint32(0, box.size)
	}
	bytes.set([0x66, 0x72, 0x65, 0x65], 4) // "free"
	return bytes
}

/** The part of the file under `box`, with the bytes in `spans` zeroed. */
function zeroed(file: Blob, box: Box, spans: Span[]): BlobPart[] {
	const end = box.start + box.size
	const inside = spans
		.map((span) => ({ start: Math.max(span.start, box.start), end: Math.min(span.end, end) }))
		.filter((span) => span.start < span.end)
		.sort((a, b) => a.start - b.start)
	const parts: BlobPart[] = []
	let at = box.start
	for (const span of inside) {
		if (span.start > at) parts.push(file.slice(at, span.start))
		const from = Math.max(at, span.start)
		if (span.end > from) parts.push(new Uint8Array(span.end - from))
		at = Math.max(at, span.end)
	}
	if (at < end) parts.push(file.slice(at, end))
	return parts
}

/** Check the top-level layout: one movie header, media data, and no fragments. */
function check_layout(boxes: Box[]) {
	if (boxes[0]?.type !== 'ftyp') fail('not an MP4')
	if (boxes.some((box) => box.type === 'moof')) fail('fragmented MP4')
	const moovs = boxes.filter((box) => box.type === 'moov')
	if (moovs.length !== 1 || !boxes.some((box) => box.type === 'mdat')) fail('no movie')
	return moovs[0]
}

/**
 * A copy of an MP4 or QuickTime file without its metadata, and its length in seconds. Throws
 * `MetadataError` for anything it can't fully parse, so such a file is refused, not stored.
 */
export async function strip_video(file: Blob): Promise<{ video: Blob; seconds: number }> {
	const boxes = await top_level(file)
	// `moov` may come after `mdat`, and says which of its bytes to zero, so it's read first.
	const moov = await load(file, check_layout(boxes))
	const spans: Span[] = []
	scrub(moov.view, moov.bytes, moov.box, spans)
	if (spans.reduce((sum, span) => sum + span.end - span.start, 0) > HEADER_MAX)
		fail('too much metadata')
	const seconds = movie_seconds(moov.view, moov.box)

	const parts = boxes.flatMap((box): BlobPart[] => {
		if (box.type === 'moov') return [moov.bytes]
		if (KEPT_TOP.has(box.type)) return zeroed(file, box, spans)
		return [padding(box)]
	})
	return { video: new Blob(parts, { type: 'video/mp4' }), seconds }
}
