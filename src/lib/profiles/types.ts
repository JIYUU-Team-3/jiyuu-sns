import type { Author } from '#lib/posts/types'

export type ProfileView = Author & {
	handle: string
	bio: string
	/** A `/media/…` URL, or undefined for the plain fallback. */
	banner?: string
	/** When the account was created, in milliseconds since the epoch. */
	joined: number
	followers: number
	following: number
	followed: boolean
	follows_you: boolean
	mine: boolean
}
