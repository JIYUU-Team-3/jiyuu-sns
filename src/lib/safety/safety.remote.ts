import { error } from '@sveltejs/kit'
import * as v from 'valibot'
import { command, query } from '$app/server'
import { get_profile } from '#lib/profiles/profiles.remote'
import * as safety from '#lib/server/safety'
import { member, signed_in } from '#lib/server/session'
import { normalize_term, REPORT_NOTE_MAX, REPORT_REASONS, TERM_MAX } from './rules'

const Handle = v.pipe(v.string(), v.regex(/^[a-z0-9_.]{3,20}$/))
const Toggle = v.object({ handle: Handle, on: v.boolean() })
const Term = v.pipe(v.string(), v.maxLength(TERM_MAX * 8))

export const get_safety = query(() => {
	const { db, user_id } = signed_in()
	return safety.safety_lists(db, user_id)
})

export const set_block = command(Toggle, async ({ handle, on }) => {
	const { db, user_id } = await member()
	if (!(await safety.set_block(db, user_id, handle, on))) error(404, 'Profile not found.')
	await Promise.all([get_profile(handle).refresh(), get_safety().refresh()])
})

export const set_mute = command(Toggle, async ({ handle, on }) => {
	const { db, user_id } = await member()
	if (!(await safety.set_mute(db, user_id, handle, on))) error(404, 'Profile not found.')
	await Promise.all([get_profile(handle).refresh(), get_safety().refresh()])
})

export const mute_term = command(Term, async (raw) => {
	const term = normalize_term(raw)
	if (!term) error(400, 'term_invalid')
	const { db, user_id } = await member()
	if ((await safety.add_muted_term(db, user_id, term)) === 'full') error(409, 'terms_full')
	await get_safety().refresh()
})

export const unmute_term = command(Term, async (term) => {
	const { db, user_id } = await member()
	await safety.remove_muted_term(db, user_id, term)
	await get_safety().refresh()
})

export const answer_request = command(
	v.object({ handle: Handle, approve: v.boolean() }),
	async ({ handle, approve }) => {
		const { db, user_id } = await member()
		await safety.answer_request(db, user_id, handle, approve)
		await get_safety().refresh()
	},
)

export const set_private = command(v.boolean(), async (on) => {
	const { db, user_id } = await member()
	await safety.set_private(db, user_id, on)
	await get_safety().refresh()
})

export const report = command(
	v.object({
		handle: Handle,
		post_id: v.optional(v.pipe(v.string(), v.uuid())),
		reason: v.picklist(REPORT_REASONS),
		note: v.pipe(v.optional(v.string(), ''), v.trim(), v.maxLength(REPORT_NOTE_MAX)),
	}),
	async (input) => {
		const { db, user_id } = await member()
		if (!(await safety.save_report(db, user_id, input))) error(404, 'Not found.')
	},
)
