import { describe, expect, it } from 'vitest'
import { safe_next, with_next } from './next'

describe('safe_next', () => {
	it('keeps a path on this site with its query', () => {
		expect(safe_next('/p/abc')).toBe('/p/abc')
		expect(safe_next('/ja/search?q=a%20b')).toBe('/ja/search?q=a%20b')
	})

	it('refuses anything that could leave the site', () => {
		for (const value of [
			'https://evil.example/',
			'//evil.example',
			'/\\evil.example',
			'/\t/evil.example',
			'/.//evil.example',
			'javascript:alert(1)',
			'p/abc',
			'',
			null,
			undefined,
			['/p/abc'],
			`/${'a'.repeat(2048)}`,
		]) {
			expect(safe_next(value), String(value)).toBeUndefined()
		}
	})
})

describe('with_next', () => {
	it('adds the encoded path only when there is one', () => {
		expect(with_next('/login', '/p/a?x=1')).toBe('/login?next=%2Fp%2Fa%3Fx%3D1')
		expect(with_next('/login', undefined)).toBe('/login')
	})
})
