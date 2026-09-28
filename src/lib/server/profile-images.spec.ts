import { describe, expect, it } from 'vitest'
import { image_changes } from './profile-images'

describe('image_changes', () => {
	it('keeps stored images when nothing was picked or removed', () => {
		expect(image_changes({}, {})).toEqual({})
	})

	it('clears a removed image', () => {
		expect(image_changes({}, { banner: true })).toEqual({ banner: null })
	})

	it('lets a new upload win over a removal of the same kind', () => {
		expect(image_changes({ avatar: '/media/a' }, { avatar: true, banner: true })).toEqual({
			avatar: '/media/a',
			banner: null,
		})
	})
})
