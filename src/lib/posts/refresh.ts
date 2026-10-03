import { feed_arg } from './args'
import { get_feed } from './posts.remote'
import { timeline } from './state.svelte'
import type { FeedTab } from './types'

export async function refresh_feed(tab: FeedTab) {
	await get_feed(feed_arg(tab)).refresh()
	timeline.reload()
}
