import { describe, expect, it } from 'vitest'
import type { MessagePart } from '#lib/paraglide/runtime'
import { link_segments } from './rich-text'

const text = (value: string): MessagePart => ({ type: 'text', value })
const tag = (type: 'markup-start' | 'markup-end', name: string): MessagePart => ({
	type,
	name,
	options: {},
	attributes: {},
})

describe('link_segments', () => {
	it('attaches the href to text inside a known tag', () => {
		const parts = [
			text('See '),
			tag('markup-start', 'terms'),
			text('Terms'),
			tag('markup-end', 'terms'),
			text('.'),
		]

		expect(link_segments(parts, { terms: '/terms' })).toEqual([
			{ text: 'See ' },
			{ text: 'Terms', href: '/terms' },
			{ text: '.' },
		])
	})

	it('keeps text inside an unknown tag plain', () => {
		const parts = [tag('markup-start', 'mystery'), text('plain'), tag('markup-end', 'mystery')]

		expect(link_segments(parts, {})).toEqual([{ text: 'plain' }])
	})

	it('ignores standalone markup', () => {
		const parts: MessagePart[] = [
			text('a'),
			{ type: 'markup-standalone', name: 'x', options: {}, attributes: {} },
			text('b'),
		]

		expect(link_segments(parts, {})).toEqual([{ text: 'a' }, { text: 'b' }])
	})
})
