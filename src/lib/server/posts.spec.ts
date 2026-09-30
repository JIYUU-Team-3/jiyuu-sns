import { describe, expect, it } from 'vitest'
import { kept_media } from './posts'

const current = [{ url: '/a' }, { url: '/b', alt: 'old' }, { url: '/c' }]

describe('kept_media', () => {
	it('drops and reorders what the post already has', () => {
		expect(kept_media(current, [{ url: '/c' }, { url: '/a' }])).toEqual([
			{ url: '/c', alt: null },
			{ url: '/a', alt: null },
		])
		expect(kept_media(current, [])).toEqual([])
	})

	it('sets or clears descriptions', () => {
		expect(kept_media(current, [{ url: '/a', alt: 'new' }, { url: '/b' }])).toEqual([
			{ url: '/a', alt: 'new' },
			{ url: '/b', alt: null },
		])
	})

	it('refuses new or repeated items', () => {
		expect(kept_media(current, [{ url: '/a' }, { url: '/x' }])).toBeUndefined()
		expect(kept_media(current, [{ url: '/a' }, { url: '/a' }])).toBeUndefined()
	})
})
