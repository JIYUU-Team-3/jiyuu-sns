export type Author = {
	id: string
	/** Display name, falling back to the account name until onboarding saves a profile. */
	name: string
	/** Undefined for an account that hasn't picked a handle yet. */
	handle?: string
	image?: string
}

export type PostView = {
	id: string
	body: string
	/** Milliseconds since the epoch. */
	created_at: number
	edited: boolean
	author: Author
	/** The post this one replies to; `handle` is missing when that author has none yet. */
	reply_to?: { id: string; handle?: string }
	replies: number
	likes: number
	/** Whether the viewer liked it. */
	liked: boolean
	/** Whether the viewer wrote it, so it offers Edit and Delete. */
	mine: boolean
}

export type FeedTab = 'for_you' | 'following'

export type PostPage = {
	posts: PostView[]
	/** Pass back as `cursor` for the next page; undefined on the last one. */
	next?: string
}
