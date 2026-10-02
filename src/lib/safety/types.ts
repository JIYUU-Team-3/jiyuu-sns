import type { Author } from '#lib/posts/types'

export type Account = Author & { handle: string }

export type SafetyLists = {
	blocked: Account[]
	muted: Account[]
	terms: string[]
	requests: Account[]
	private: boolean
}
