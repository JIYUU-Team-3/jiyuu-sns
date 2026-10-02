import type { Rule } from '#lib/moderation/rules'
import type { Author, PostView } from '#lib/posts/types'

export type NotificationType = 'follow' | 'like' | 'reply' | 'mention' | 'moderation'

export type NotificationTab = 'all' | 'mentions'

export type NotificationView = {
	id: string
	type: NotificationType
	/** Milliseconds since the epoch. */
	created_at: number
	/** Unread when the page was loaded; opening the page marks everything read. */
	unread: boolean
	actor: Author
	post_id?: string
	/** The liked post's text, for a like. */
	snippet?: string
	/** The reply or the mentioning post, shown as a card. */
	post?: PostView
	/**
	 * For `moderation`: what a moderator did to the viewer's post, and under which rule.
	 * `review_refused` when the viewer asked for a review of a removal and it was kept.
	 */
	moderation?: { action: 'remove' | 'limit' | 'restore'; reason?: Rule; review_refused?: boolean }
}

export type NotificationPage = {
	items: NotificationView[]
	next?: string
}
