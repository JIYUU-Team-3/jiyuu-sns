import { and, eq } from 'drizzle-orm'
import { guess_language } from '#lib/posts/language'
import type { Locale } from '#lib/paraglide/runtime'
import { cached } from './cache'
import type { getDb } from './db'
import { post, profile } from './db/schema'
import { MODELS, neurons } from './moderation/ai'
import { ai_enabled, QuotaError, run_model } from './moderation/ai-client'
import { exhaust, reserve, settle } from './moderation/budget'
import { visible_posts } from './safety'

type Db = ReturnType<typeof getDb>

/** A translation is kept a month; an edit changes the key, so it's never stale. */
const CACHE_TTL = 30 * 24 * 60 * 60

export type Translation = { from: Locale; text: string }

/** Why a post can't be translated right now. */
export type TranslateRefusal = 'not_found' | 'same_language' | 'unavailable' | 'busy'

/**
 * Neurons to set aside for one post: m2m100 bills input and output tokens alike, and a kana or
 * Khmer letter can be a token on its own, so every character is counted as one, both ways.
 */
export function translate_estimate(body: string) {
	const tokens = [...body].length
	return Math.max(1, neurons('translate', { prompt_tokens: tokens, completion_tokens: tokens }))
}

/**
 * The post's text in `to`, when the viewer may see the post. Cached per post, edit and language,
 * so a popular post is translated once per location; paid for from the day's `translate` budget.
 */
export async function translate_post(
	db: Db,
	viewer: string,
	post_id: string,
	to: Locale,
	{ enabled = ai_enabled(), fetcher = fetch }: { enabled?: boolean; fetcher?: typeof fetch } = {},
): Promise<Translation | TranslateRefusal> {
	const [row] = await db
		.select({ body: post.body, edited_at: post.editedAt })
		.from(post)
		.leftJoin(profile, eq(profile.userId, post.authorId))
		.where(and(visible_posts(viewer), eq(post.id, post_id)))
		.limit(1)
	if (!row) return 'not_found'
	const from = guess_language(row.body)
	if (!from || from === to) return 'same_language'
	if (!enabled) return 'unavailable'

	const key = `translate:${post_id}:${row.edited_at?.getTime() ?? 0}:${to}`
	const text = await cached(key, CACHE_TTL, () => run(db, row.body, from, to, fetcher), Boolean)
	return text ? { from, text } : 'busy'
}

/** One call to the model, within the day's budget; undefined when there's none left or it fails. */
async function run(db: Db, body: string, from: Locale, to: Locale, fetcher: typeof fetch) {
	const estimate = translate_estimate(body)
	if (!(await reserve(db, 'translate', estimate))) return undefined
	try {
		const answer = (await run_model(
			MODELS.translate.id,
			{ text: body, source_lang: from, target_lang: to },
			fetcher,
		)) as { translated_text?: unknown }
		// The model reports no token counts, so the estimate stands as the cost.
		const text = typeof answer.translated_text === 'string' ? answer.translated_text.trim() : ''
		if (!text) await settle(db, 'translate', estimate, 0)
		return text || undefined
	} catch (error) {
		if (error instanceof QuotaError) await exhaust(db)
		else await settle(db, 'translate', estimate, 0)
		console.error('Translation failed', error)
		return undefined
	}
}
