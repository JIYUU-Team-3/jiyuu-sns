import type { NotificationTab } from './types'

/** First pages are keyed without a `cursor`, like the post lists. */
export const notifications_arg = (tab: NotificationTab, cursor?: string) =>
	cursor ? { tab, cursor } : { tab }
