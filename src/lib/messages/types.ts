import type { Author } from '#lib/posts/types'

export type MessageMediaKind = 'image' | 'gif'

export type MessageMedia = { kind: MessageMediaKind; url: string; width: number; height: number }

export type Reaction = { emoji: string; count: number; mine: boolean }

export type GroupEventKind =
	| 'created'
	| 'added'
	| 'removed'
	| 'left'
	| 'admin_on'
	| 'admin_off'
	| 'owner'
	| 'renamed'
	| 'photo'

/** A line the group wrote about itself; `sender` did it, to `target` where there is one. */
export type GroupEvent = { kind: GroupEventKind; target?: string }

export type MessageView = {
	id: string
	sender: Author
	/** Set on a system line such as "Mika added Ken"; a rename's new name is in `body`. */
	event?: GroupEvent
	mine: boolean
	body: string
	/** Blocked domains the text mentions; links to them are drawn as plain text. */
	blocked_hosts: string[]
	media?: MessageMedia
	reply_to?: {
		id: string
		sender_name: string
		mine: boolean
		body: string
		media_kind?: MessageMediaKind
	}
	reactions: Reaction[]
	created_at: number
}

export type OutgoingMessage = { body: string; media?: MessageMedia }

export type Receipt = { user_id: string; read_at?: number; delivered_at?: number }

export type ReceiptStatus = { status: 'sent' | 'delivered' | 'seen'; seen_by: string[] }

export type MessagePage = {
	items: MessageView[]
	receipts: Receipt[]
	next?: string
}

export type LastMessage = {
	sender_name: string
	mine: boolean
	body: string
	media_kind?: MessageMediaKind
	created_at: number
}

/** A group has one owner, who names admins; owner and admins can remove people. */
export type MemberRole = 'owner' | 'admin' | 'member'

export type ConversationView = {
	id: string
	name?: string
	/** A group's own photo, shown instead of its members' faces. */
	image?: string
	group: boolean
	/** The viewer's own role; `members` lists everyone else. */
	role: MemberRole
	members: (Author & { handle?: string; joined?: number; role: MemberRole })[]
	last?: LastMessage
	unread: boolean
	updated_at: number
}

export type ConversationPage = {
	items: ConversationView[]
	next?: string
}
