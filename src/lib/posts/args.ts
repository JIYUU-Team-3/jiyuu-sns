import type { FollowSide, ProfileTab } from '#lib/profiles/types'
import type { FeedTab } from './types'

/*
 * Query arguments are compared by value, so a first page is always keyed without a `cursor`.
 * That way the refresh a new post sends back from the server lands on the exact query the
 * client is showing.
 */

export const feed_arg = (tab: FeedTab, cursor?: string) => (cursor ? { tab, cursor } : { tab })

export const replies_arg = (id: string, cursor?: string) => (cursor ? { id, cursor } : { id })

export const author_arg = (id: string, tab: ProfileTab, cursor?: string) =>
	cursor ? { id, tab, cursor } : { id, tab }

export const bookmarks_arg = (cursor?: string) => (cursor ? { cursor } : {})

export const follows_arg = (id: string, side: FollowSide, cursor?: string) =>
	cursor ? { id, side, cursor } : { id, side }
