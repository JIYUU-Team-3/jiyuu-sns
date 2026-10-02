import { and, eq, inArray } from 'drizzle-orm'
import type { Rule } from '#lib/moderation/rules'
import type { getDb } from '../db'
import { post, postMedia, profile } from '../db/schema'
import { media_key } from '../media'
import {
	guard_input,
	is_english,
	MODELS,
	neurons,
	parse_guard,
	parse_vision,
	vision_input,
	type GuardCategory,
	type ImageScores,
} from './ai'
import { QuotaError, run_model, type AiAnswer } from './ai-client'
import { ESTIMATE, exhaust, reserve, settle, type BudgetKind } from './budget'
import { raise_case } from './cases'
import { moderate_post } from './posts'
import { is_limited, trust_level, type Trust } from './trust'

type Db = ReturnType<typeof getDb>

export type CheckDeps = {
	bucket: R2Bucket
	/** False when Workers AI isn't configured; every check is then skipped. */
	enabled: boolean
	fetcher?: typeof fetch
	/** For sampling a normal account's images; tests pass their own. */
	random?: () => number
}

/**
 * Images over this size aren't sent: encoding one costs CPU, and the Free plan gives a Worker
 * 10 ms of it per run. Larger ones are left to reports.
 */
const IMAGE_CHECK_MAX_BYTES = 1024 * 1024
/** The share of a normal account's images that are checked; all of a new account's, none of a trusted one's. */
const NORMAL_IMAGE_SAMPLE = 0.25

/** What Llama Guard's categories mean in Jiyuu's rules. */
const GUARD_RULES: Partial<Record<GuardCategory, Rule>> = {
	S1: 'threat',
	S2: 'illegal_goods',
	S3: 'sexual',
	S4: 'child_safety',
	S5: 'harassment',
	S7: 'doxxing',
	S9: 'terrorism',
	S10: 'hate',
	S11: 'self_harm_encouragement',
	S12: 'sexual',
}
/** Categories that hide a new account's post until a moderator looks. */
const HIDE_FOR_NEW: GuardCategory[] = ['S1', 'S9', 'S10', 'S12']

type Outcome = 'ok' | 'incomplete'

/** One call under the budget; undefined when there was no budget or no usable answer. */
async function ask(
	db: Db,
	deps: CheckDeps,
	kind: BudgetKind,
	model: keyof typeof MODELS,
	input: unknown,
	limited: boolean,
): Promise<AiAnswer | undefined> {
	const estimate = ESTIMATE[kind]
	if (!(await reserve(db, kind, estimate, limited))) return undefined
	try {
		const answer = await run_model(MODELS[model].id, input, deps.fetcher)
		await settle(db, kind, estimate, neurons(model, answer.usage))
		return answer
	} catch (error) {
		// Out of quota: stop for the day. Any other failure cost nothing, so its reservation goes
		// back; otherwise an outage would use up the budget on calls that never ran.
		if (error instanceof QuotaError) await exhaust(db)
		else await settle(db, kind, estimate, 0)
		return undefined
	}
}

/** The stored image as a data URL, the only way the vision model takes one; undefined if too big. */
async function image_data_url(bucket: R2Bucket, url: string) {
	const key = media_key(url)
	if (!key || key.endsWith('.mp4')) return undefined
	const object = await bucket.get(key)
	if (!object || object.size > IMAGE_CHECK_MAX_BYTES) return undefined
	const bytes = new Uint8Array(await object.arrayBuffer())
	let binary = ''
	for (let i = 0; i < bytes.length; i += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
	}
	const type = object.httpMetadata?.contentType ?? 'image/jpeg'
	return `data:${type};base64,${btoa(binary)}`
}

/** Which of a post's images to look at, by how much its author is trusted. */
function images_to_check(urls: string[], trust: Trust, all: boolean, random: () => number) {
	if (all || is_limited(trust)) return urls
	if (trust === 'trusted') return []
	return urls.filter(() => random() < NORMAL_IMAGE_SAMPLE)
}

const worst = (scores: ImageScores) => Math.max(scores.nudity, scores.violence, scores.gore)
const image_rule = (scores: ImageScores): Rule =>
	scores.nudity >= scores.gore && scores.nudity >= scores.violence ? 'sexual' : 'gore'

/**
 * Run the automatic checks on a post and act on what they find: hide it for a moderator, blur its
 * media, or only raise its case. `budget` is `report` when a report asked for it, which also looks
 * at every image. Returns what the post's `checked` becomes.
 */
export async function check_post(
	db: Db,
	deps: CheckDeps,
	post_id: string,
	budget: 'text' | 'report' = 'text',
) {
	const [row] = await db
		.select({ body: post.body, author_id: post.authorId, moderation: post.moderation })
		.from(post)
		.where(eq(post.id, post_id))
		.limit(1)
	if (!row) return undefined
	if (!deps.enabled || row.moderation === 'removed') {
		await db.update(post).set({ checked: 'skipped' }).where(eq(post.id, post_id))
		return 'skipped'
	}
	const trust = await trust_level(db, row.author_id)
	const limited = is_limited(trust)
	const target = { kind: 'post' as const, id: post_id, user_id: row.author_id }
	let outcome: Outcome = 'ok'
	let looked = false

	if (is_english(row.body)) {
		looked = true
		const answer = await ask(db, deps, budget, 'text', guard_input(row.body), limited)
		const verdict = answer && parse_guard(answer.response)
		if (!verdict) outcome = 'incomplete'
		else if (!verdict.safe) {
			const reason = verdict.categories.map((code) => GUARD_RULES[code]).find(Boolean)
			const severe = verdict.categories.includes('S4')
			const hide = severe || (limited && verdict.categories.some((c) => HIDE_FOR_NEW.includes(c)))
			if (hide) await moderate_post(db, { moderator_id: null, post_id, action: 'limit', reason })
			await raise_case(db, target, {
				reason,
				weight: severe ? 100 : hide ? 10 : 2,
				flags: { text: verdict.categories },
			})
		}
	}

	const images = await db
		.select({ url: postMedia.url })
		.from(postMedia)
		.where(and(eq(postMedia.postId, post_id), inArray(postMedia.kind, ['image'])))
	const chosen = images_to_check(
		images.map((image) => image.url),
		trust,
		budget === 'report',
		deps.random ?? Math.random,
	)
	const kind: BudgetKind = budget === 'report' ? 'report' : 'image'
	const flagged: { url: string; scores: ImageScores }[] = []
	for (const url of chosen) {
		const data_url = await image_data_url(deps.bucket, url)
		if (!data_url) continue
		looked = true
		const answer = await ask(db, deps, kind, 'image', vision_input(data_url), limited)
		const scores = answer && parse_vision(answer.response)
		if (!scores) outcome = 'incomplete'
		else if (worst(scores) >= 2) flagged.push({ url, scores })
	}
	if (flagged.length) {
		const most = flagged.reduce((a, b) => (worst(b.scores) > worst(a.scores) ? b : a), flagged[0])
		await moderate_post(db, { moderator_id: null, post_id, action: 'sensitive' })
		if (worst(most.scores) >= 3) {
			const reason = image_rule(most.scores)
			await moderate_post(db, { moderator_id: null, post_id, action: 'limit', reason })
			await raise_case(db, target, { reason, weight: 10, flags: { images: flagged } })
		}
	}

	const checked = outcome === 'incomplete' ? 'unchecked' : looked ? 'checked' : 'skipped'
	await db.update(post).set({ checked }).where(eq(post.id, post_id))
	return checked
}

/**
 * Check a profile after it's saved: the bio's text, and the photo and banner, which show on every
 * post. A profile can't be hidden, so findings only raise its case.
 */
export async function check_profile(db: Db, deps: CheckDeps, user_id: string) {
	if (!deps.enabled) return
	const [row] = await db
		.select({ bio: profile.bio, avatar: profile.avatarUrl, banner: profile.bannerUrl })
		.from(profile)
		.where(eq(profile.userId, user_id))
		.limit(1)
	if (!row) return
	const limited = is_limited(await trust_level(db, user_id))
	const target = { kind: 'profile' as const, id: user_id, user_id }

	if (is_english(row.bio)) {
		const answer = await ask(db, deps, 'text', 'text', guard_input(row.bio), limited)
		const verdict = answer && parse_guard(answer.response)
		if (verdict && !verdict.safe) {
			const reason = verdict.categories.map((code) => GUARD_RULES[code]).find(Boolean)
			await raise_case(db, target, { reason, weight: 5, flags: { bio: verdict.categories } })
		}
	}
	for (const url of [row.avatar, row.banner]) {
		const data_url = url && (await image_data_url(deps.bucket, url))
		if (!url || !data_url) continue
		const answer = await ask(db, deps, 'image', 'image', vision_input(data_url), limited)
		const scores = answer && parse_vision(answer.response)
		if (scores && worst(scores) >= 2) {
			await raise_case(db, target, {
				reason: image_rule(scores),
				weight: worst(scores) >= 3 ? 10 : 2,
				flags: { images: [{ url, scores }] },
			})
		}
	}
}
