import type { Author } from '#lib/posts/types'

export type MessageMediaKind = 'image' | 'gif' | 'file'

export type MessageMedia =
	| { kind: 'image' | 'gif'; url: string; width: number; height: number }
	| { kind: 'file'; url: string; name: string; size: number }

export type Reaction = { emoji: string; count: number; mine: boolean }

export type MessageView = {
	id: string
	sender: Author
	mine: boolean
	body: string
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

export type ConversationView = {
	id: string
	name?: string
	group: boolean
	members: (Author & { handle?: string; joined?: number })[]
	last?: LastMessage
	unread: boolean
	updated_at: number
}

export type ConversationPage = {
	items: ConversationView[]
	next?: string
}
