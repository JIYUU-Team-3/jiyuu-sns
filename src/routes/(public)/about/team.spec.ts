import { describe, expect, it } from 'vitest'
import { with_live, type Member } from './team'

const member: Member = { name: 'Old', jiyuu: 'dev', handle: 'dev-gh', pfp: '/snap.webp', hue: 0 }

describe('with_live', () => {
	it('keeps the snapshot without a live profile', () => {
		expect(with_live([member], [])).toEqual([member])
	})

	it('takes the live name and photo', () => {
		const [shown] = with_live([member], [{ handle: 'dev', name: 'New', image: '/media/a.webp' }])
		expect(shown).toMatchObject({ name: 'New', pfp: '/media/a.webp', handle: 'dev-gh' })
	})

	it('drops the snapshot photo once the member has removed theirs', () => {
		const [shown] = with_live([member], [{ handle: 'dev', name: 'New' }])
		expect(shown.pfp).toBeUndefined()
	})

	it('matches on the Jiyuu handle, not the GitHub one', () => {
		expect(with_live([member], [{ handle: 'dev-gh', name: 'Wrong' }])).toEqual([member])
	})
})
