import type { Author } from '#lib/posts/types'

/** An account in a list, such as search results or who to follow. */
export type UserView = Author & {
	handle: string
	bio: string
	/** Where they say they are, shown under the handle. */
	location?: string
	followed: boolean
	private: boolean
	requested: boolean
	/** Whether this is the viewer. */
	mine: boolean
}

export type TagView = {
	/** Without the `#`. */
	tag: string
	posts: number
}
