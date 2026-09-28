import type { Author } from '#lib/posts/types'

export type ProfileView = Author & {
	handle: string
	bio: string
	followers: number
	following: number
	followed: boolean
	follows_you: boolean
	mine: boolean
}
