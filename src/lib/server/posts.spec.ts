import { describe, expect, it } from 'vitest'
import { kept_media, last_at_cap, OFFSET_MAX, PAGE_SIZE } from './posts'

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

describe('last_at_cap', () => {
	const page = { posts: [], next: 'more' }

	it('keeps paging until the next page would start past the cap', () => {
		expect(last_at_cap(page, 0).next).toBe('more')
		expect(last_at_cap(page, OFFSET_MAX - PAGE_SIZE).next).toBe('more')
		expect(last_at_cap(page, OFFSET_MAX).next).toBeUndefined()
	})
})
