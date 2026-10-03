import type { Author } from '#lib/posts/types'
import type { Birthday } from './details'

export type ProfileView = Author & {
	handle: string
	bio: string
	/** A `/media/…` URL, or undefined for the plain fallback. */
	banner?: string
	location?: string
	/** As much of the birthday as the viewer may see; undefined when it's hidden or not given. */
	birthday?: Birthday
	/** When the account was created, in milliseconds since the epoch. */
	joined: number
	/** Top-level posts only, matching the Posts tab. */
	posts: number
	followers: number
	following: number
	followed: boolean
	follows_you: boolean
	private: boolean
	requested: boolean
	blocked: boolean
	blocks_you: boolean
	muted: boolean
	/** Whether this is the viewer's own profile. */
	mine: boolean
}

export type ProfileTab = 'posts' | 'replies' | 'likes'
