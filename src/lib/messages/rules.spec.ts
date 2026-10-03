import { describe, expect, it } from 'vitest'
import {
	can_remove,
	conversation_title,
	direct_key,
	MESSAGE_MAX,
	message_problem,
	receipt_status,
	same_day,
	toggle_reaction,
} from './rules'

describe('message_problem', () => {
	it('needs text or media', () => {
		expect(message_problem('')).toBe('empty')
		expect(message_problem('', true)).toBeUndefined()
		expect(message_problem('hi')).toBeUndefined()
	})

	it('counts graphemes up to the limit', () => {
		expect(message_problem('👍🏽'.repeat(MESSAGE_MAX))).toBeUndefined()
		expect(message_problem('a'.repeat(MESSAGE_MAX + 1))).toBe('too_long')
	})
})

describe('can_remove', () => {
	it('lets the owner remove anyone else, and an admin only plain members', () => {
		expect(can_remove('owner', 'admin')).toBe(true)
		expect(can_remove('owner', 'member')).toBe(true)
		expect(can_remove('owner', 'owner')).toBe(false)
		expect(can_remove('admin', 'member')).toBe(true)
		expect(can_remove('admin', 'admin')).toBe(false)
		expect(can_remove('admin', 'owner')).toBe(false)
		expect(can_remove('member', 'member')).toBe(false)
	})
})

describe('direct_key', () => {
	it('is the same whoever starts the chat', () => {
		expect(direct_key('b', 'a')).toBe('a:b')
		expect(direct_key('a', 'b')).toBe('a:b')
	})
})

describe('conversation_title', () => {
	it('prefers the group name, then the member names', () => {
		expect(conversation_title({ name: 'Team', members: [{ name: 'Sora' }] }, 'x')).toBe('Team')
		expect(conversation_title({ members: [{ name: 'Sora' }, { name: 'Dan' }] }, 'x')).toBe(
			'Sora, Dan',
		)
		expect(conversation_title({ members: [] }, 'Deleted account')).toBe('Deleted account')
	})
})

describe('same_day', () => {
	it('compares calendar days, not 24 hours', () => {
		const morning = new Date(2026, 8, 30, 0, 5).getTime()
		const night = new Date(2026, 8, 30, 23, 55).getTime()
		const next = new Date(2026, 9, 1, 0, 1).getTime()
		expect(same_day(morning, night)).toBe(true)
		expect(same_day(night, next)).toBe(false)
	})
})

describe('toggle_reaction', () => {
	it('adds, switches and removes the viewer’s one reaction', () => {
		const start = [{ emoji: '👍', count: 1, mine: false }]
		const added = toggle_reaction(start, '👍')
		expect(added).toEqual([{ emoji: '👍', count: 2, mine: true }])
		const switched = toggle_reaction(added, '😂')
		expect(switched).toEqual([
			{ emoji: '👍', count: 1, mine: false },
			{ emoji: '😂', count: 1, mine: true },
		])
		expect(toggle_reaction(switched, '😂')).toEqual(start)
	})
})

describe('receipt_status', () => {
	it('moves from sent to delivered to seen', () => {
		expect(receipt_status(10, [{ user_id: 'a', read_at: 5, delivered_at: 5 }])).toEqual({
			status: 'sent',
			seen_by: [],
		})
		expect(receipt_status(10, [{ user_id: 'a', read_at: 5, delivered_at: 12 }]).status).toBe(
			'delivered',
		)
		expect(receipt_status(10, [{ user_id: 'a', read_at: 10 }])).toEqual({
			status: 'seen',
			seen_by: ['a'],
		})
	})

	it('needs everyone in a group for delivered, anyone for seen', () => {
		const late = { user_id: 'b', delivered_at: 1 }
		expect(receipt_status(10, [{ user_id: 'a', delivered_at: 20 }, late]).status).toBe('sent')
		expect(receipt_status(10, [{ user_id: 'a', read_at: 20 }, late]).seen_by).toEqual(['a'])
	})

	it('stays sent with nobody left to receive it', () => {
		expect(receipt_status(10, []).status).toBe('sent')
	})
})
