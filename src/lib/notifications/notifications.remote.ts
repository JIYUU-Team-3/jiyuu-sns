import { error } from '@sveltejs/kit'
import * as v from 'valibot'
import { command, getRequestEvent, query } from '$app/server'
import * as notifications from '#lib/server/notifications'

const Cursor = v.optional(v.pipe(v.string(), v.maxLength(80)))

/** Notifications are always someone's own: no session, nothing to show. */
function me() {
	const { locals } = getRequestEvent()
	if (!locals.user) error(401, 'Sign in to continue.')
	return { db: locals.db, user_id: locals.user.id }
}

export const get_notifications = query(
	v.object({ tab: v.picklist(['all', 'mentions']), cursor: Cursor }),
	({ tab, cursor }) => {
		const { db, user_id } = me()
		return notifications.notifications_page(db, user_id, tab, cursor)
	},
)

export const get_unread_count = query(() => {
	const { db, user_id } = me()
	return notifications.unread_count(db, user_id)
})

/** Called once the list is on screen, so the rows still show which ones were new. */
export const mark_notifications_read = command(async () => {
	const { db, user_id } = me()
	await notifications.mark_read(db, user_id)
	await get_unread_count().refresh()
})
