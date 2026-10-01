import { error, fail } from '@sveltejs/kit'
import { eq } from 'drizzle-orm'
import { is_rule, SUSPENSION_DAYS } from '#lib/moderation/rules'
import { accountStanding, profile } from '#lib/server/db/schema'
import { read_form } from '#lib/server/form'
import { require_moderator } from '#lib/server/moderation/guard'
import {
	account_history,
	active_suspension,
	lift_suspension,
	strike_counts,
	suspend,
} from '#lib/server/moderation/standing'
import { limit } from '#lib/server/rate-limit'
import type { Actions, PageServerLoad } from './$types'

/** A moderator's note to the person, kept short: it's shown on their suspension page. */
const NOTE_MAX = 500

async function find_account(db: App.Locals['db'], handle: string) {
	const [row] = await db
		.select({
			id: profile.userId,
			handle: profile.handle,
			name: profile.displayName,
			role: accountStanding.role,
			suspendedAt: accountStanding.suspendedAt,
			suspendedUntil: accountStanding.suspendedUntil,
			suspendReason: accountStanding.suspendReason,
			suspendActionId: accountStanding.suspendActionId,
		})
		.from(profile)
		.leftJoin(accountStanding, eq(accountStanding.userId, profile.userId))
		.where(eq(profile.handle, handle))
		.limit(1)
	if (!row) error(404, 'Not found.')
	return row
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const { db } = require_moderator(locals)
	const account = await find_account(db, params.handle)
	const [strikes, history] = await Promise.all([
		strike_counts(db, account.id),
		account_history(db, account.id),
	])
	const suspension = active_suspension(account)
	return {
		account: {
			id: account.id,
			handle: account.handle,
			name: account.name,
			moderator: account.role === 'moderator',
		},
		suspension: suspension && {
			until: suspension.until,
			reason: is_rule(suspension.reason) ? suspension.reason : undefined,
		},
		strikes,
		history: history.map((row) => ({
			...row,
			reason: is_rule(row.reason) ? row.reason : undefined,
			expires_at: row.expires_at?.getTime() ?? null,
			created_at: row.created_at.getTime(),
			reversed: row.reversed_at !== null,
		})),
	}
}

export const actions: Actions = {
	suspend: async ({ locals, params, request }) => {
		const { db, user_id } = require_moderator(locals)
		await limit('MOD_LIMIT', user_id)
		const account = await find_account(db, params.handle)
		const data = await read_form(request, 4096)

		const reason = data.get('reason')
		const days_field = String(data.get('days') ?? '')
		const days = days_field === 'permanent' ? null : Number(days_field)
		const note = String(data.get('note') ?? '').trim()
		if (!is_rule(reason) || !(SUSPENSION_DAYS as readonly (number | null)[]).includes(days)) {
			return fail(400, { invalid: true })
		}
		if ([...note].length > NOTE_MAX) return fail(400, { invalid: true })

		const action = await suspend(db, {
			moderator_id: user_id,
			user_id: account.id,
			reason,
			days,
			note,
		})
		if (!action) return fail(409, { moderator: true })
	},

	lift: async ({ locals, params }) => {
		const { db, user_id } = require_moderator(locals)
		await limit('MOD_LIMIT', user_id)
		const account = await find_account(db, params.handle)
		await lift_suspension(db, user_id, account.id)
	},
}
