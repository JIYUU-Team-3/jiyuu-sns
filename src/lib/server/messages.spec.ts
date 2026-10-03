import { beforeEach, describe, expect, it } from 'vitest'
import { MEMBER_MAX } from '#lib/messages/rules'
import { block, conversation } from './db/schema'
import { add_account, test_db, type TestDb } from './db/test-d1'
import {
	add_members,
	can_see_media,
	conversations_page,
	find_conversation,
	leave_conversation,
	media_in_use,
	messages_page,
	react,
	remove_member,
	rename_group,
	set_admin,
	send_message,
	set_group_image,
	start_conversation,
	transfer_owner,
	unread_count,
} from './messages'

describe('group settings', () => {
	let db: TestDb
	let group: string

	/** Everyone in the group and their role, as `viewer` sees it. */
	async function roles(viewer: string) {
		const view = await find_conversation(db, viewer, group)
		if (!view) return undefined
		return Object.fromEntries([
			[viewer, view.role],
			...view.members.map((member) => [member.id, member.role]),
		])
	}

	beforeEach(async () => {
		db = test_db()
		for (const handle of ['olive', 'adam', 'mia', 'max', 'eve']) await add_account(db, handle)
		// Olive starts the group and owns it; Eve is never in it.
		group = (await start_conversation(db, 'olive', ['adam', 'mia', 'max'], 'Trip')) as string
		await set_admin(db, 'olive', group, 'adam', true)
	})

	it('makes whoever starts a group its owner, and lets only the owner name admins', async () => {
		expect(await roles('olive')).toEqual({
			olive: 'owner',
			adam: 'admin',
			mia: 'member',
			max: 'member',
		})
		expect(await set_admin(db, 'adam', group, 'mia', true)).toBe(false)
		expect(await set_admin(db, 'mia', group, 'mia', true)).toBe(false)
		expect(await set_admin(db, 'eve', group, 'mia', true)).toBe(false)
		expect(await set_admin(db, 'adam', group, 'adam', false)).toBe(false)
		expect((await roles('olive'))?.mia).toBe('member')

		expect(await set_admin(db, 'olive', group, 'adam', false)).toBe(true)
		expect((await roles('olive'))?.adam).toBe('member')
	})

	it('lets the owner and admins remove people, and nobody else', async () => {
		expect(await remove_member(db, 'mia', group, 'max')).toBe(false)
		expect(await remove_member(db, 'eve', group, 'max')).toBe(false)
		// An admin can't remove the owner or another admin, and nobody removes themselves this way.
		expect(await remove_member(db, 'adam', group, 'olive')).toBe(false)
		await set_admin(db, 'olive', group, 'mia', true)
		expect(await remove_member(db, 'adam', group, 'mia')).toBe(false)
		expect(await remove_member(db, 'olive', group, 'olive')).toBe(false)
		expect(Object.keys((await roles('olive')) ?? {})).toHaveLength(4)

		expect(await remove_member(db, 'adam', group, 'max')).toBe(true)
		expect(await remove_member(db, 'olive', group, 'mia')).toBe(true)
		expect(await roles('olive')).toEqual({ olive: 'owner', adam: 'admin' })
		expect(await find_conversation(db, 'max', group)).toBeUndefined()
	})

	it('lets members rename the group and add people, and outsiders do neither', async () => {
		expect(await rename_group(db, 'eve', group, 'Mine now')).toBe(false)
		expect(await add_members(db, 'eve', group, ['eve'])).toBe('not_found')
		expect((await find_conversation(db, 'olive', group))?.name).toBe('Trip')

		expect(await rename_group(db, 'mia', group, 'Trip to Kyoto')).toBe(true)
		expect((await find_conversation(db, 'olive', group))?.name).toBe('Trip to Kyoto')
		expect(await add_members(db, 'mia', group, ['eve', 'adam'])).toEqual(['eve'])
		expect((await roles('eve'))?.eve).toBe('member')
		expect(await add_members(db, 'mia', group, ['nobody'])).toBe('invalid')
	})

	it('adds nobody who blocked the person adding them, and stops at the member limit', async () => {
		await db.insert(block).values({ blockerId: 'eve', blockedId: 'mia' })
		expect(await add_members(db, 'mia', group, ['eve'])).toBe('invalid')
		expect(await find_conversation(db, 'eve', group)).toBeUndefined()

		const crowd = Array.from({ length: MEMBER_MAX - 3 }, (_, i) => `extra${i}`)
		for (const handle of crowd) await add_account(db, handle)
		expect(await add_members(db, 'olive', group, crowd)).toBe('full')
		expect(await add_members(db, 'olive', group, crowd.slice(1))).toHaveLength(MEMBER_MAX - 4)
	})

	it('starts a group as large as the limit allows', async () => {
		const crowd = Array.from({ length: MEMBER_MAX - 1 }, (_, i) => `extra${i}`)
		for (const handle of crowd) await add_account(db, handle)
		group = (await start_conversation(db, 'eve', crowd, undefined)) as string
		const all = await roles('eve')
		expect(Object.keys(all ?? {})).toHaveLength(MEMBER_MAX)
		expect(Object.values(all ?? {}).filter((role) => role === 'owner')).toHaveLength(1)
	})

	/** The chat's system lines, oldest first, as "who kind whom". */
	async function lines(viewer: string) {
		const page = await messages_page(db, viewer, group, undefined)
		return (page?.items ?? [])
			.filter((item) => item.event)
			.reverse()
			.map((item) =>
				[item.sender.name, item.event?.kind, item.event?.target ?? item.body].join(' ').trim(),
			)
	}

	it('writes what happened to the group into its chat', async () => {
		await rename_group(db, 'mia', group, 'Kyoto')
		await add_members(db, 'mia', group, ['eve'])
		await remove_member(db, 'adam', group, 'max')
		await set_admin(db, 'olive', group, 'adam', false)
		await leave_conversation(db, 'eve', group)
		// What was refused leaves no line.
		await remove_member(db, 'mia', group, 'adam')
		await set_admin(db, 'mia', group, 'mia', true)

		// Sorted, since lines written in the same millisecond come back in either order.
		expect((await lines('olive')).sort()).toEqual(
			[
				'olive created',
				'olive admin_on adam',
				'mia renamed Kyoto',
				'mia added eve',
				'adam removed max',
				'olive admin_off adam',
				'eve left',
			].sort(),
		)
		// A line is not a message: nothing to read, reply to or react to.
		expect(await unread_count(db, 'mia')).toBe(0)
		const page = await messages_page(db, 'olive', group, undefined)
		const line = page?.items.find((item) => item.event)?.id as string
		expect(await react(db, 'olive', line, '👍')).toBeUndefined()
		expect(await send_message(db, 'olive', group, { body: 'hi', reply_to: line })).toBe('not_found')
	})

	it('lets only the owner hand the group over, to someone in it', async () => {
		expect(await transfer_owner(db, 'adam', group, 'mia')).toBe(false)
		expect(await transfer_owner(db, 'eve', group, 'eve')).toBe(false)
		expect(await transfer_owner(db, 'olive', group, 'eve')).toBe(false)
		expect(await transfer_owner(db, 'olive', group, 'olive')).toBe(false)
		expect((await roles('olive'))?.olive).toBe('owner')

		expect(await transfer_owner(db, 'olive', group, 'mia')).toBe(true)
		expect(await roles('olive')).toEqual({
			olive: 'admin',
			adam: 'admin',
			mia: 'owner',
			max: 'member',
		})
		expect(await transfer_owner(db, 'olive', group, 'adam')).toBe(false)
		expect((await lines('max')).at(-1)).toBe('olive owner mia')
	})

	it('lists a new group for everyone in it before anyone writes, but not an empty direct chat', async () => {
		const inbox = async (viewer: string) =>
			(await conversations_page(db, viewer, undefined)).items.map((item) => item.id)
		const direct = (await start_conversation(db, 'olive', ['eve'], undefined)) as string

		expect(await inbox('mia')).toEqual([group])
		expect((await inbox('olive')).sort()).toEqual([group, direct].sort())
		expect(await inbox('eve')).toEqual([])
		await add_members(db, 'mia', group, ['eve'])
		expect(await inbox('eve')).toEqual([group])
	})

	it('has no settings for a direct chat', async () => {
		const direct = (await start_conversation(db, 'olive', ['eve'], undefined)) as string
		expect(await rename_group(db, 'olive', direct, 'Named')).toBe(false)
		expect(await add_members(db, 'olive', direct, ['adam'])).toBe('not_found')
		expect(await set_group_image(db, 'olive', direct, undefined)).toBe('not_found')
		expect(await remove_member(db, 'olive', direct, 'eve')).toBe(false)
		expect(await set_admin(db, 'olive', direct, 'eve', true)).toBe(false)
		expect(await transfer_owner(db, 'olive', direct, 'eve')).toBe(false)
	})

	it('hands the group to an admin, or the longest-standing member, when its owner leaves', async () => {
		expect(await leave_conversation(db, 'olive', group)).toBe(true)
		expect(await roles('adam')).toEqual({ adam: 'owner', mia: 'member', max: 'member' })
		expect(await leave_conversation(db, 'adam', group)).toBe(true)
		const after = await roles('mia')
		expect(Object.values(after ?? {}).sort()).toEqual(['member', 'owner'])
	})

	it('shows a group photo to its members only, and says what it replaced', async () => {
		const first = '/media/messages/mia/11111111-1111-4111-8111-111111111111.png'
		const second = '/media/messages/adam/22222222-2222-4222-8222-222222222222.png'
		expect(await set_group_image(db, 'eve', group, first)).toBe('not_found')
		expect(await set_group_image(db, 'mia', group, first)).toEqual({ replaced: undefined })
		expect((await find_conversation(db, 'olive', group))?.image).toBe(first)
		expect(await can_see_media(db, 'max', first)).toBe(true)
		expect(await can_see_media(db, 'eve', first)).toBe(false)
		expect(await media_in_use(db, first)).toBe(true)

		expect(await set_group_image(db, 'adam', group, second)).toEqual({ replaced: first })
		expect(await media_in_use(db, first)).toBe(false)
		expect(await set_group_image(db, 'adam', group, undefined)).toEqual({ replaced: second })
		expect((await find_conversation(db, 'olive', group))?.image).toBeUndefined()
	})

	it('never shows a photo that is not one of our uploads', async () => {
		await db.update(conversation).set({ image: 'https://evil.example/pixel.png' })
		expect((await find_conversation(db, 'olive', group))?.image).toBeUndefined()
	})
})
