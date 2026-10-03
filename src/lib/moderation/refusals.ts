import { m } from '#lib/paraglide/messages.js'

/** Why the server refused a post, message or follow, as `server/moderation/write.ts` names it. */
const REFUSALS: Record<string, () => string> = {
	link_lookalike: m.refusal_link_lookalike,
	link_address: m.refusal_link_address,
	link_blocked: m.refusal_link_blocked,
	link_new_account: m.refusal_link_new_account,
	link_too_many: m.refusal_link_too_many,
	post_duplicate: m.refusal_post_duplicate,
	post_rate: m.refusal_post_rate,
	video_new_account: m.refusal_video_new_account,
	gif_rating: m.refusal_gif_rating,
	chat_new_account: m.refusal_chat_new_account,
	follow_rate: m.refusal_follow_rate,
	group_full: m.refusal_group_full,
}

/** The sentence for a refusal a remote function threw, or `fallback` for any other failure. */
export function refusal_message(cause: unknown, fallback: () => string) {
	const code = (cause as { body?: { message?: unknown } } | undefined)?.body?.message
	return typeof code === 'string' && Object.hasOwn(REFUSALS, code) ? REFUSALS[code]() : fallback()
}
