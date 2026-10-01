import { describe, expect, it } from 'vitest'
import { is_blocked_link } from './blocked'

describe('is_blocked_link', () => {
	it('matches the domain and its subdomains exactly', () => {
		const blocked = ['evil.example']
		expect(is_blocked_link('https://evil.example/x', blocked)).toBe(true)
		expect(is_blocked_link('https://cdn.evil.example/x', blocked)).toBe(true)
		expect(is_blocked_link('https://notevil.example/x', blocked)).toBe(false)
		expect(is_blocked_link('https://evil.example.com/x', blocked)).toBe(false)
		expect(is_blocked_link('https://evil.example/x', [])).toBe(false)
	})
})
