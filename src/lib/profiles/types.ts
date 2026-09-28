import type { Author } from '#lib/posts/types'

export type ProfileView = Author & {
	handle: string
	bio: string
	/** The banner image; undefined shows a plain fill. */
	header?: string
	/** When the account was created, in milliseconds since the epoch. */
	joined_at: number
	/** Top-level posts only, matching the Posts tab. */
	posts: number
	followers: number
	following: number
	followed: boolean
	follows_you: boolean
	/** Whether this is the viewer's own profile. */
	mine: boolean
}

export type ProfileTab = 'posts' | 'replies'
