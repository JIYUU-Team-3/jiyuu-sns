import { describe, expect, it } from 'vitest'
import { account_image } from './account-image'

describe('account_image', () => {
	it('shows a Google account photo', () => {
		const photo = 'https://lh3.googleusercontent.com/a/abc=s96-c'
		expect(account_image(photo)).toBe(photo)
	})

	it('shows nothing for a URL the account could have pointed anywhere', () => {
		expect(account_image('https://tracker.example/pixel.png')).toBeUndefined()
		expect(account_image('https://lh3.googleusercontent.com.evil.example/a')).toBeUndefined()
		expect(account_image('http://lh3.googleusercontent.com/a')).toBeUndefined()
		expect(account_image('javascript:alert(1)')).toBeUndefined()
		expect(account_image(null)).toBeUndefined()
	})
})
