import { post_length } from '#lib/posts/rules'
import type { Reaction } from './types'

export const MESSAGE_MAX = 1000

export const GROUP_NAME_MAX = 50

export const MEMBER_MAX = 50

export const REACTIONS = ['❤️', '😂', '👍', '🙌', '👀', '😮'] as const

export type ReactionEmoji = (typeof REACTIONS)[number]

export const is_reaction = (emoji: string): emoji is ReactionEmoji =>
	(REACTIONS as readonly string[]).includes(emoji)

export type MessageProblem = 'empty' | 'too_long'

export function message_problem(body: string, has_media = false): MessageProblem | undefined {
	if (!body && !has_media) return 'empty'
	if (post_length(body) > MESSAGE_MAX) return 'too_long'
	return undefined
}

export const direct_key = (a: string, b: string) => (a < b ? `${a}:${b}` : `${b}:${a}`)

export function conversation_title(
	convo: { name?: string; members: { name: string }[] },
	fallback: string,
) {
	if (convo.name) return convo.name
	return convo.members.map((member) => member.name).join(', ') || fallback
}

export function same_day(a: number, b: number) {
	const x = new Date(a)
	const y = new Date(b)
	return (
		x.getFullYear() === y.getFullYear() &&
		x.getMonth() === y.getMonth() &&
		x.getDate() === y.getDate()
	)
}

export function toggle_reaction(list: Reaction[], emoji: string): Reaction[] {
	const previous = list.find((reaction) => reaction.mine)
	const rest = list
		.map((reaction) =>
			reaction.mine ? { ...reaction, count: reaction.count - 1, mine: false } : reaction,
		)
		.filter((reaction) => reaction.count > 0)
	if (previous?.emoji === emoji) return rest
	if (rest.some((reaction) => reaction.emoji === emoji))
		return rest.map((reaction) =>
			reaction.emoji === emoji ? { ...reaction, count: reaction.count + 1, mine: true } : reaction,
		)
	return [...rest, { emoji, count: 1, mine: true }]
}
