import type { ReplyAudience } from '#lib/safety/rules'

export type Author = {
	id: string
	/** Display name, falling back to the account name until onboarding saves a profile. */
	name: string
	/** Undefined for an account that hasn't picked a handle yet. */
	handle?: string
	image?: string
	/** Moderates Jiyuu, which a shield beside the name shows. */
	moderator?: boolean
	verified?: boolean
}

export type MediaKind = 'image' | 'gif' | 'video'

/** Photos and videos are our uploads in R2; GIFs come from the picker's CDN. */
export const is_upload = (kind: MediaKind) => kind !== 'gif'

/**
 * A photo or video (uploaded to R2) or a GIF (from the picker's CDN), with its size for layout
 * and the author's description (alt text), if they wrote one.
 */
export type Media = { kind: MediaKind; url: string; width: number; height: number; alt?: string }

export type PollView = {
	options: { label: string; votes: number }[]
	/** Milliseconds since the epoch. */
	ends_at: number
	/** The option the viewer picked, if they voted. */
	voted?: number
}

/** The post a quote embeds, with just enough for a compact card. */
export type QuotedPost = {
	id: string
	body: string
	/** Milliseconds since the epoch. */
	created_at: number
	author: Author
	media: Media[]
	/** Its media is marked sensitive, so the card leaves it out; the post itself has the cover. */
	sensitive: boolean
}

/**
 * The card under a post with a link: what the linked page says about itself. Its picture is our
 * own copy, so readers never reach the site until they open the link.
 */
export type LinkPreview = {
	url: string
	title: string
	description?: string
	site_name?: string
	image?: { url: string; width: number; height: number }
}

export type PostView = {
	id: string
	body: string
	/** Milliseconds since the epoch. */
	created_at: number
	edited: boolean
	author: Author
	/** The post this one replies to; `handle` is missing when that author has none yet. */
	reply_to?: { id: string; handle?: string; self: boolean }
	continued: boolean
	media: Media[]
	/** The post this one quotes; `post` is missing once that post is deleted. */
	quote?: { id: string; post?: QuotedPost }
	poll?: PollView
	/** The card for its first link, once the server has read that page. */
	link?: LinkPreview
	location?: string
	replies: number
	likes: number
	reposts: number
	quotes: number
	/** Whether the viewer liked it. */
	liked: boolean
	/** Whether the viewer reposted it. */
	reposted: boolean
	/** Whether the viewer saved it. Bookmarks are private, so there is no count. */
	bookmarked: boolean
	/** Whether the viewer wrote it, so it offers Edit and Delete. */
	mine: boolean
	/** Whether its author pinned it to their profile. */
	pinned: boolean
	/** Set on the entry at the top of a profile's Posts tab that shows the pinned post. */
	pin_top?: true
	/** Media blurred until the viewer opens it. */
	sensitive: boolean
	/** Set only for the author of a post a moderator limited or removed; nobody else sees it. */
	moderation?: 'limited' | 'removed'
	/** Blocked domains its text mentions; links to them are drawn as plain text. */
	blocked_hosts: string[]
	/**
	 * The author's account is under a month old, so its links go through the "leaving Jiyuu" page.
	 * (New accounts can't post links at all; this covers the ones that just became able to.)
	 */
	warn_links: boolean
	reply_audience: ReplyAudience
	can_reply: boolean
	/** Whether the viewer may repost or quote it: not a private account's, unless it's theirs. */
	can_share: boolean
	/**
	 * Set when this timeline entry is someone's repost of the post, not the post itself; `mine`
	 * when that someone is the viewer.
	 */
	repost?: { by: Author; at: number; mine: boolean }
}

/** A timeline entry's identity: a post can appear once as itself and again in reposts. */
export const entry_key = (post: PostView) =>
	post.pin_top ? `${post.id}:pinned` : post.repost ? `${post.id}:${post.repost.by.id}` : post.id

export type FeedTab = 'for_you' | 'following'

export type PostPage = {
	posts: PostView[]
	/** Pass back as `cursor` for the next page; undefined on the last one. */
	next?: string
}

/** A page of Home's timeline. */
export type FeedPage = PostPage & {
	/** When the server read the timeline, in its own milliseconds; later posts are "new". */
	as_of: number
}

type Size = { url: string; width: number; height: number }

/** A GIF picker result: a small rendition for the grid, a bigger one for the post. */
export type Gif = { id: string; title: string; preview: Size; full: Size }

/** A place search result: `name` is what the post shows, `detail` helps tell places apart. */
export type Place = { name: string; detail: string }
