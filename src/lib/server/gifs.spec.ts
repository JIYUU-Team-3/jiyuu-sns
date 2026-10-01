import { describe, expect, it } from 'vitest'
import { gif_id } from './gifs'

describe('gif_id', () => {
	it('reads the id from each GIPHY URL shape', () => {
		expect(gif_id('https://media1.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif?cid=1')).toBe(
			'l0MYt5jPR6QX5pnqM',
		)
		expect(gif_id('https://media.giphy.com/media/v1.Y2lkPTc5/3o7aD2saalBwwftBIY/200w.gif')).toBe(
			'3o7aD2saalBwwftBIY',
		)
		expect(gif_id('https://i.giphy.com/3o7aD2saalBwwftBIY.gif')).toBe('3o7aD2saalBwwftBIY')
	})

	it('refuses anything else', () => {
		expect(gif_id('https://media1.giphy.com/')).toBeUndefined()
		expect(gif_id('not a url')).toBeUndefined()
		expect(gif_id('https://media1.giphy.com/media/../giphy.gif')).toBeUndefined()
	})
})
