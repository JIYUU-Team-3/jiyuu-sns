export type ProfileView = {
	id: string
	handle: string
	name: string
	bio: string
	image?: string
	/** The banner image; undefined shows a plain fill. */
	header?: string
	/** When the account was created, in milliseconds since the epoch. */
	joined_at: number
	/** Top-level posts only, matching the Posts tab. */
	posts: number
	following: number
	followers: number
	/** Whether this is the viewer's own profile. */
	mine: boolean
}

export type ProfileTab = 'posts' | 'replies'
