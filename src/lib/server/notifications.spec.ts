import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MEMBER_MAX } from '#lib/messages/rules'
import { block } from './db/schema'
import { add_account, test_db, type TestDb } from './db/test-d1'
import { add_members, remove_member, rename_group, start_conversation } from './messages'
import { notifications_page, notify_group } from './notifications'

// Pushes go out through the Worker's own runtime, which a unit test doesn't have.
vi.mock('cloudflare:workers', () => ({ env: {}, waitUntil: () => {} }))

describe('group chat notifications', () => {
	let db: TestDb
	let group: string

	/** What `viewer`'s list says about groups, newest first, as "who type name". */
	async function lines(viewer: string) {
		const page = await notifications_page(db, viewer, 'all', undefined)
		return page.items.map((item) => [item.actor.name, item.type, item.group?.name].join(' ').trim())
	}

	beforeEach(async () => {
		db = test_db()
		for (const handle of ['olive', 'adam', 'mia', 'eve']) await add_account(db, handle)
		group = (await start_conversation(db, 'olive', ['adam', 'mia'], 'Trip')) as string
	})

	it('tells the people put in a group, and never the one who did it', async () => {
		await notify_group(db, 'olive', group, 'group_add', ['olive', 'adam', 'mia', 'mia'])
		expect(await lines('adam')).toEqual(['olive group_add Trip'])
		expect(await lines('mia')).toEqual(['olive group_add Trip'])
		expect(await lines('olive')).toEqual([])
	})

	it('links to the group only while the reader is in it, under the name it had then', async () => {
		await add_members(db, 'olive', group, ['eve'])
		await notify_group(db, 'olive', group, 'group_add', ['eve'])
		const added = await notifications_page(db, 'eve', 'all', undefined)
		expect(added.items[0].group).toEqual({ id: group, name: 'Trip' })

		await remove_member(db, 'olive', group, 'eve')
		await notify_group(db, 'olive', group, 'group_remove', ['eve'])
		await rename_group(db, 'olive', group, 'Without Eve')
		// One line about the group, not one per change, and nothing Eve couldn't already see.
		const removed = await notifications_page(db, 'eve', 'all', undefined)
		expect(removed.items).toHaveLength(1)
		expect(removed.items[0].type).toBe('group_remove')
		expect(removed.items[0].group).toEqual({ id: undefined, name: 'Trip' })
	})

	it('says nothing across a block, or about a direct chat', async () => {
		await db.insert(block).values({ blockerId: 'adam', blockedId: 'olive' })
		await notify_group(db, 'olive', group, 'group_add', ['adam'])
		expect(await lines('adam')).toEqual([])

		const direct = (await start_conversation(db, 'olive', ['eve'], undefined)) as string
		await notify_group(db, 'olive', direct, 'group_add', ['eve'])
		expect(await lines('eve')).toEqual([])
	})

	it('tells everyone in a group as large as the limit allows', async () => {
		const crowd = Array.from({ length: MEMBER_MAX - 1 }, (_, i) => `extra${i}`)
		for (const handle of crowd) await add_account(db, handle)
		const big = (await start_conversation(db, 'eve', crowd, undefined)) as string
		await notify_group(db, 'eve', big, 'group_add', crowd)
		expect(await lines(crowd[0])).toEqual(['eve group_add'])
		expect(await lines(crowd.at(-1) as string)).toEqual(['eve group_add'])
	})
})
