import { and, eq, inArray } from 'drizzle-orm'
import type { Rule } from '#lib/moderation/rules'
import type { getDb } from '../db'
import { mediaCheck, post, postMedia, profile } from '../db/schema'
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
	/** Shrinks an image too big to send; without it (unit tests) such an image is passed over. */
	images?: ImagesBinding
	/** False when Workers AI isn't configured; every check is then skipped. */
	enabled: boolean
	fetcher?: typeof fetch
	/** For sampling a normal account's images; tests pass their own. */
	random?: () => number
}

/**
 * Images over this size aren't sent as they are: encoding one costs CPU, and the Free plan gives a
 * Worker 10 ms of it per run. Cloudflare Images makes a small copy of a larger one, outside that
 * limit; the Free plan allows 5,000 a month and then refuses, which leaves the image to reports.
 */
const IMAGE_CHECK_MAX_BYTES = 1024 * 1024
/** The longest side of the copy made for the model, which doesn't need more to tell what it shows. */
const IMAGE_CHECK_PIXELS = 1024
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
		// Posting carries on either way, so the log is the only place a broken check shows.
		console.error(
			`Moderation check (${model}) didn't run:`,
			error instanceof QuotaError ? 'the Workers AI allocation for today is used up' : error,
		)
		return undefined
	}
}

/** A small JPEG of a stored image, just for the model; undefined when Cloudflare Images refuses. */
async function shrink(images: ImagesBinding, object: R2ObjectBody) {
	try {
		const result = await images
			.input(object.body)
			.transform({ width: IMAGE_CHECK_PIXELS, height: IMAGE_CHECK_PIXELS, fit: 'scale-down' })
			.output({ format: 'image/jpeg' })
		const bytes = new Uint8Array(await result.response().arrayBuffer())
		return bytes.length <= IMAGE_CHECK_MAX_BYTES ? bytes : undefined
	} catch {
		return undefined
	}
}

/** The stored image as a data URL, the only way the vision model takes one; undefined if it can't be sent. */
async function image_data_url(deps: CheckDeps, url: string) {
	const key = media_key(url)
	if (!key || key.endsWith('.mp4')) return undefined
	const object = await deps.bucket.get(key)
	if (!object) return undefined
	const large = object.size > IMAGE_CHECK_MAX_BYTES
	if (large && !deps.images) return undefined
	const bytes = large
		? await shrink(deps.images!, object)
		: new Uint8Array(await object.arrayBuffer())
	if (!bytes) return undefined
	let binary = ''
	for (let i = 0; i < bytes.length; i += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
	}
	const type = large ? 'image/jpeg' : (object.httpMetadata?.contentType ?? 'image/jpeg')
	return `data:${type};base64,${btoa(binary)}`
}

/** Which of a post's images to look at, by how much its author is trusted. */
function images_to_check(urls: string[], trust: Trust, all: boolean, random: () => number) {
	if (all || is_limited(trust)) return urls
	if (trust === 'trusted') return []
	return urls.filter(() => random() < NORMAL_IMAGE_SAMPLE)
}

const worst = (scores: ImageScores) => Math.max(scores.nudity, scores.violence, scores.gore)
/** The score from which media goes behind the sensitive cover. */
const SENSITIVE_SCORE = 2
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
	const urls = images.map((image) => image.url)
	// What `check_upload` found while the post was written isn't asked again; an image it passed
	// over stays passed over, unless a report wants everything looked at.
	const known = await upload_checks(db, urls)
	const flagged: { url: string; scores: ImageScores }[] = []
	for (const [url, scores] of known) {
		if (!scores) continue
		looked = true
		if (worst(scores) >= SENSITIVE_SCORE) flagged.push({ url, scores })
	}
	const chosen = images_to_check(
		urls.filter((url) => (budget === 'report' ? !known.get(url) : !known.has(url))),
		trust,
		budget === 'report',
		deps.random ?? Math.random,
	)
	const kind: BudgetKind = budget === 'report' ? 'report' : 'image'
	for (const url of chosen) {
		const data_url = await image_data_url(deps, url)
		if (!data_url) continue
		looked = true
		const answer = await ask(db, deps, kind, 'image', vision_input(data_url), limited)
		const scores = answer && parse_vision(answer.response)
		if (!scores) outcome = 'incomplete'
		else if (worst(scores) >= SENSITIVE_SCORE) flagged.push({ url, scores })
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

/** What `check_upload` stored for each of `urls`: its scores, or undefined where it passed one over. */
async function upload_checks(db: Db, urls: string[]) {
	const rows = urls.length
		? await db.select().from(mediaCheck).where(inArray(mediaCheck.url, urls))
		: []
	return new Map(
		rows.map(({ url, nudity, violence, gore }) => [
			url,
			nudity === null || violence === null || gore === null
				? undefined
				: { nudity, violence, gore },
		]),
	)
}

/** Which of `urls` were found sensitive while their post was written, so publishing marks it. */
export async function sensitive_uploads(db: Db, urls: string[]) {
	const known = await upload_checks(db, urls)
	return new Set(urls.filter((url) => worst(known.get(url) ?? NO_SCORES) >= SENSITIVE_SCORE))
}

const NO_SCORES: ImageScores = { nudity: 0, violence: 0, gore: 0 }

/**
 * Look at a post photo as soon as it's uploaded, so its author can be told before publishing that
 * it will sit behind the sensitive cover. The same images are looked at as after publishing, by
 * trust, and the answer is kept so each upload is asked about once. True when it is sensitive.
 */
export async function check_upload(db: Db, deps: CheckDeps, user_id: string, url: string) {
	if (!deps.enabled) return false
	const known = await upload_checks(db, [url])
	if (known.has(url)) return worst(known.get(url) ?? NO_SCORES) >= SENSITIVE_SCORE
	const trust = await trust_level(db, user_id)
	let scores: ImageScores | undefined
	if (images_to_check([url], trust, false, deps.random ?? Math.random).length) {
		const data_url = await image_data_url(deps, url)
		const answer =
			data_url && (await ask(db, deps, 'image', 'image', vision_input(data_url), is_limited(trust)))
		scores = answer ? parse_vision(answer.response) : undefined
		// Nothing is kept when the check couldn't run, so the post's own check tries again.
		if (!scores) return false
	}
	await db
		.insert(mediaCheck)
		.values({ url, userId: user_id, ...scores })
		.onConflictDoNothing()
	return !!scores && worst(scores) >= SENSITIVE_SCORE
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
		const data_url = url && (await image_data_url(deps, url))
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
