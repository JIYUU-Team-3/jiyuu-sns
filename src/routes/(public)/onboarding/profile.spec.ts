import { describe, expect, it } from 'vitest'
import { avatar_hue, handle_problem, initials, profile_errors, read_profile } from './profile'

describe('handle_problem', () => {
	it('accepts 3 to 20 lowercase letters, numbers, underscores, and periods', () => {
		expect(handle_problem('mika')).toBeUndefined()
		expect(handle_problem('mika.tanaka_99')).toBeUndefined()
		expect(handle_problem('a'.repeat(20))).toBeUndefined()
	})

	it('rejects bad length or characters', () => {
		expect(handle_problem('')).toBe('format')
		expect(handle_problem('mk')).toBe('format')
		expect(handle_problem('a'.repeat(21))).toBe('format')
		expect(handle_problem('mika tanaka')).toBe('format')
		expect(handle_problem('@mika')).toBe('format')
	})

	it('rejects capital letters', () => {
		expect(handle_problem('Mika')).toBe('format')
		expect(handle_problem('MIKA_99')).toBe('format')
	})

	it('treats reserved handles as taken', () => {
		expect(handle_problem('jiyuu')).toBe('taken')
		expect(handle_problem('admin')).toBe('taken')
	})
})

describe('profile_errors', () => {
	it('is empty for a valid draft', () => {
		expect(profile_errors({ name: 'Mika', handle: 'mika', bio: '' })).toEqual({})
	})

	it('flags a missing name and a bad handle together', () => {
		expect(profile_errors({ name: '', handle: 'x', bio: '' })).toEqual({
			name: 'required',
			handle: 'format',
		})
	})
})

describe('read_profile', () => {
	it('trims fields and clips them to their limits', () => {
		const data = new FormData()
		data.set('name', `  ${'n'.repeat(60)}  `)
		data.set('handle', ' mika ')
		data.set('bio', 'b'.repeat(200))
		const draft = read_profile(data)
		expect(draft.name).toHaveLength(50)
		expect(draft.handle).toBe('mika')
		expect(draft.bio).toHaveLength(160)
	})

	it('reads missing fields as empty', () => {
		expect(read_profile(new FormData())).toEqual({ name: '', handle: '', bio: '' })
	})
})

describe('avatar', () => {
	it('keeps one hue per seed', () => {
		expect(avatar_hue('mika@example.com')).toBe(avatar_hue('mika@example.com'))
		expect(avatar_hue('mika@example.com')).toBeGreaterThanOrEqual(0)
		expect(avatar_hue('mika@example.com')).toBeLessThan(360)
	})

	it('takes up to two initials', () => {
		expect(initials('Mika Tanaka')).toBe('MT')
		expect(initials('mika')).toBe('M')
		expect(initials('Anna Maria Lopez')).toBe('AM')
		expect(initials('  ')).toBe('')
	})
})
