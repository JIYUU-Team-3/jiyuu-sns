import { describe, expect, it } from 'vitest'
import { guess_language, translatable } from './language'

describe('guess_language', () => {
	it('tells the three apart by script', () => {
		expect(guess_language('We’re cooked, see you tomorrow')).toBe('en')
		expect(guess_language('今日はいい天気ですね')).toBe('ja')
		expect(guess_language('漢字だけ')).toBe('ja')
		expect(guess_language('សួស្តី អ្នកសុខសប្បាយទេ')).toBe('km')
	})

	it('goes by the main script of mixed text', () => {
		expect(guess_language('SvelteKitの勉強をしています')).toBe('ja')
		expect(guess_language('Going to 東京 next week with friends')).toBe('en')
	})

	it('ignores links, tags and mentions', () => {
		expect(
			guess_language('すごい！ https://example.com/some/long/english/path #WutheringWaves'),
		).toBe('ja')
		expect(guess_language('@someone_long_handle #tag')).toBeUndefined()
	})

	it('skips text too short or in no script it knows', () => {
		expect(guess_language('ok')).toBeUndefined()
		expect(guess_language('😂😂😂 !!!')).toBeUndefined()
		expect(guess_language('Привет, как дела')).toBeUndefined()
	})
})

describe('translatable', () => {
	it('offers a translation only into another language', () => {
		expect(translatable('今日はいい天気ですね', 'en')).toBe(true)
		expect(translatable('今日はいい天気ですね', 'ja')).toBe(false)
		expect(translatable('ok', 'ja')).toBe(false)
	})
})
