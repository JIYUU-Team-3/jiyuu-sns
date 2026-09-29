export type Author = {
	id: string
	/** Display name, falling back to the account name until onboarding saves a profile. */
	name: string
	/** Undefined for an account that hasn't picked a handle yet. */
	handle?: string
	image?: string
}

export type MediaKind = 'image' | 'gif'

/**
 * A photo (uploaded to R2) or a GIF (from the picker's CDN), with its size for layout and the
 * author's description (alt text), if they wrote one.
 */
export type Media = { kind: MediaKind; url: string; width: number; height: number; alt?: string }

export type PollView = {
	options: { label: string; votes: number }[]
	/** Milliseconds since the epoch. */
	ends_at: number
	/** The option the viewer picked, if they voted. */
	voted?: number
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
	media: Media[]
	poll?: PollView
	location?: string
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

type Size = { url: string; width: number; height: number }

/** A GIF picker result: a small rendition for the grid, a bigger one for the post. */
export type Gif = { id: string; title: string; preview: Size; full: Size }

/** A place search result: `name` is what the post shows, `detail` helps tell places apart. */
export type Place = { name: string; detail: string }
