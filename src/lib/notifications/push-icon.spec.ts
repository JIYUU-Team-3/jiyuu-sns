import { describe, expect, it } from 'vitest'
import { face_source } from './push-icon'

const ORIGIN = 'https://jiyuu.example'

describe('face_source', () => {
	it('loads the app’s own uploads with the sign-in cookie', () => {
		expect(face_source('/media/avatars/u1/a.webp', ORIGIN)).toEqual({
			url: `${ORIGIN}/media/avatars/u1/a.webp`,
			own: true,
		})
	})

	it('loads Google’s photos without it', () => {
		const url = 'https://lh3.googleusercontent.com/a/abc=s96-c'
		expect(face_source(url, ORIGIN)).toEqual({ url, own: false })
	})

	it('refuses anything else', () => {
		for (const image of [
			undefined,
			'',
			'https://evil.example/a.png',
			'//evil.example/media/a.png',
			'/media/../internal/hourly',
			'/other/a.png',
			'https://lh3.googleusercontent.com.evil.example/a.png',
			'javascript:alert(1)',
		]) {
			const source = face_source(image, ORIGIN)
			expect(source === undefined || source.url.startsWith(`${ORIGIN}/media/`)).toBe(true)
		}
	})
})
