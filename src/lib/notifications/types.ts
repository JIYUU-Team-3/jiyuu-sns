import type { Rule } from '#lib/moderation/rules'
import type { Author, PostView } from '#lib/posts/types'

export type NotificationType =
	| 'follow'
	| 'like'
	| 'reply'
	| 'mention'
	| 'repost'
	| 'quote'
	| 'moderation'
	| 'follow_request'
	| 'group_add'
	| 'group_remove'

/** The types shown as the post itself, as a card, rather than as a line about it. */
export const CARD_TYPES: NotificationType[] = ['reply', 'mention', 'quote']

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
	/** The liked or reposted post's text. */
	snippet?: string
	/** The reply, the mentioning post or the quote, shown as a card. */
	post?: PostView
	/**
	 * For `group_add` and `group_remove`: the group chat's name when it happened, if it had one,
	 * and its `id` while the viewer is in it.
	 */
	group?: { id?: string; name?: string }
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
