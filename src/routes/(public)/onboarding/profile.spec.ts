import { describe, expect, it } from 'vitest'
import {
	avatar_hue,
	handle_problem,
	initials,
	profile_errors,
	read_profile,
	suggest_handle,
} from './profile'

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

describe('suggest_handle', () => {
	it('joins the name in lowercase with underscores', () => {
		expect(suggest_handle('Mika Tanaka', 'mt@example.com')).toBe('mika_tanaka')
	})

	it('drops accents and punctuation', () => {
		expect(suggest_handle("José O'Núñez-Ruiz", 'j@example.com')).toBe('jose_o_nunez_ruiz')
	})

	it('keeps only whole words that fit in 20 characters', () => {
		expect(suggest_handle('Alexandria Ocasio Cortez', 'a@example.com')).toBe('alexandria_ocasio')
		expect(suggest_handle('Wolfeschlegelsteinhausen Berger', 'w@example.com')).toBe(
			'wolfeschlegelsteinha',
		)
	})

	it('falls back to the email when the name has no Latin letters', () => {
		expect(suggest_handle('田中 美香', 'mika.tanaka99@gmail.com')).toBe('mika_tanaka99')
		expect(suggest_handle('ហុង ម៉ានុត', 'manut@example.com')).toBe('manut')
	})

	it('skips reserved or too-short results', () => {
		expect(suggest_handle('Admin', 'jo@example.com')).toBe('')
		expect(suggest_handle('Al', 'support@example.com')).toBe('')
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
