import { describe, expect, it } from 'vitest'
import {
	IMAGE_MAX_BYTES,
	image_problem,
	picked_file,
	sniff_image,
	sniff_post_upload,
	sniff_video,
} from './media'

const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0))
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]
const file = (bytes: number[], type = 'image/png', size?: number) => {
	const body = new Uint8Array(size ?? bytes.length)
	body.set(bytes)
	return new File([body], 'x', { type })
}

describe('sniff_image', () => {
	it('recognises JPEG, PNG, GIF and WebP by their bytes', () => {
		expect(sniff_image(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))?.ext).toBe('jpg')
		expect(sniff_image(new Uint8Array(PNG))?.ext).toBe('png')
		expect(sniff_image(new Uint8Array(ascii('GIF89a')))?.ext).toBe('gif')
		expect(sniff_image(new Uint8Array(ascii('RIFF\0\0\0\0WEBP')))?.ext).toBe('webp')
	})

	it('refuses SVG and other files', () => {
		expect(sniff_image(new Uint8Array(ascii('<svg xmlns=')))).toBeUndefined()
		expect(sniff_image(new Uint8Array(ascii('RIFF\0\0\0\0WAVE')))).toBeUndefined()
		expect(sniff_image(new Uint8Array())).toBeUndefined()
	})
})

const ftyp = (brand: string) => new Uint8Array([0, 0, 0, 0x18, ...ascii('ftyp' + brand)])

describe('sniff_video', () => {
	it('recognises MP4 and QuickTime by their brand', () => {
		expect(sniff_video(ftyp('isom'))).toBe(true)
		expect(sniff_video(ftyp('mp42'))).toBe(true)
		expect(sniff_video(ftyp('qt  '))).toBe(true)
	})

	it('refuses HEIC and AVIF photos, which share the box format', () => {
		expect(sniff_video(ftyp('heic'))).toBe(false)
		expect(sniff_video(ftyp('avif'))).toBe(false)
		expect(sniff_video(ftyp('mif1'))).toBe(false)
	})

	it('refuses short and unrelated files', () => {
		expect(sniff_video(new Uint8Array(ascii('ftypisom')))).toBe(false)
		expect(sniff_video(new Uint8Array(PNG))).toBe(false)
	})
})

describe('sniff_post_upload', () => {
	it('tells photos from videos by their bytes', async () => {
		expect(await sniff_post_upload(file(PNG, 'video/mp4'))).toBe('image')
		expect(await sniff_post_upload(file([...ftyp('isom')], 'image/png'))).toBe('video')
		expect(await sniff_post_upload(file(ascii('<svg>')))).toBeUndefined()
	})
})

describe('image_problem', () => {
	it('trusts the bytes, not the claimed type', async () => {
		expect(await image_problem(file(ascii('<svg>'), 'image/png'), 'avatar')).toBe('type')
		expect(await image_problem(file(PNG, 'application/octet-stream'), 'avatar')).toBeUndefined()
	})

	it('caps each kind at its own size', async () => {
		const banner_sized = file(PNG, 'image/png', IMAGE_MAX_BYTES.avatar + 1)
		expect(await image_problem(banner_sized, 'avatar')).toBe('size')
		expect(await image_problem(banner_sized, 'banner')).toBeUndefined()
	})
})

describe('picked_file', () => {
	it('treats an empty picker as no file', () => {
		expect(picked_file(new File([], ''))).toBeUndefined()
		expect(picked_file('text')).toBeUndefined()
		expect(picked_file(null)).toBeUndefined()
	})
})
