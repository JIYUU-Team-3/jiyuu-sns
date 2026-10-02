/**
 * How Jiyuu asks Workers AI about a post and reads the answer. Pure functions only, so the app,
 * the unit tests and `scripts/measure-ai.ts` all build the same requests and parse them the same
 * way. Imports stay relative: the script runs under plain Node.
 */

/** The models, with their prices in dollars per million tokens (Workers AI's published rates). */
export const MODELS = {
	text: { id: '@cf/meta/llama-guard-3-8b', input: 0.484, output: 0.03 },
	image: { id: '@cf/meta/llama-3.2-11b-vision-instruct', input: 0.0485, output: 0.676 },
} as const

/**
 * Neurons a day for each kind of check. Workers AI's free allocation is 10,000 a day on the Free
 * plan, after which calls fail until 00:00 UTC; 1,000 are left for `pnpm ai:measure` and for
 * development. Set from Phase 0's measurements; see docs/MODERATION.md.
 */
export const DAILY_NEURONS = { text: 5500, image: 2500, report: 1000 } as const

/** Workers AI bills 1,000 neurons for $0.011. */
const DOLLARS_PER_NEURON = 0.011 / 1000

export type Usage = { prompt_tokens?: number; completion_tokens?: number }

/** Neurons a call used, from the token counts Workers AI returns with it. */
export function neurons(model: keyof typeof MODELS, usage: Usage | undefined) {
	const { input, output } = MODELS[model]
	const dollars =
		((usage?.prompt_tokens ?? 0) * input + (usage?.completion_tokens ?? 0) * output) / 1e6
	// Rounded up, less a hair so floating-point dust doesn't add a neuron to an exact count.
	return Math.max(0, Math.ceil(dollars / DOLLARS_PER_NEURON - 1e-6))
}

/**
 * Llama Guard's hazard categories. https://huggingface.co/meta-llama/Llama-Guard-3-8B
 * Spam isn't one of them; the write-time rules and behaviour score cover it.
 */
export const GUARD_CATEGORIES = {
	S1: 'violent_crimes',
	S2: 'non_violent_crimes',
	S3: 'sex_crimes',
	S4: 'child_exploitation',
	S5: 'defamation',
	S6: 'specialized_advice',
	S7: 'privacy',
	S8: 'intellectual_property',
	S9: 'indiscriminate_weapons',
	S10: 'hate',
	S11: 'self_harm',
	S12: 'sexual_content',
	S13: 'elections',
	S14: 'code_interpreter_abuse',
} as const

export type GuardCategory = keyof typeof GUARD_CATEGORIES
export type GuardResult = { safe: boolean; categories: GuardCategory[] }

/** Longer posts are cut, so one post can't cost more than this many characters of input. */
export const TEXT_INPUT_MAX = 2000

export function guard_input(text: string) {
	return {
		messages: [{ role: 'user' as const, content: text.slice(0, TEXT_INPUT_MAX) }],
		max_tokens: 16,
		temperature: 0,
	}
}

const is_category = (code: string): code is GuardCategory => code in GUARD_CATEGORIES

/**
 * Llama Guard answers `safe`, or `unsafe` and a line of categories (`S1,S10`); Workers AI may also
 * hand it back already parsed. Anything else is undefined, so the post stays unchecked rather than
 * being passed or flagged on a guess.
 */
export function parse_guard(response: unknown): GuardResult | undefined {
	if (response && typeof response === 'object') {
		const { safe, categories } = response as { safe?: unknown; categories?: unknown }
		if (typeof safe !== 'boolean') return undefined
		const codes = Array.isArray(categories) ? categories.map(String).filter(is_category) : []
		return { safe, categories: safe ? [] : codes }
	}
	if (typeof response !== 'string') return undefined
	const [verdict, codes = ''] = response.trim().split(/\s*\n\s*/)
	if (verdict === 'safe') return { safe: true, categories: [] }
	if (verdict !== 'unsafe') return undefined
	return { safe: false, categories: codes.split(/[\s,]+/).filter(is_category) }
}

/**
 * Whether the AI text check applies: it is tuned for English, so only text written mostly in
 * Latin letters goes to it. Text with no letters at all (emoji, numbers) has nothing to check.
 */
export function is_english(text: string) {
	const letters = text.match(/\p{L}/gu)
	if (!letters || letters.length < 3) return false
	const latin = text.match(/\p{Script=Latin}/gu)?.length ?? 0
	return latin / letters.length >= 0.7
}

export type ImageScores = { nudity: number; violence: number; gore: number }

const IMAGE_PROMPT = [
	'You review images for a social network. Rate this image on three scales from 0 to 3:',
	'nudity (0 none, 1 swimwear or partial, 2 suggestive or artistic nudity, 3 explicit),',
	'violence (0 none, 1 mild, 2 real fighting or weapons aimed at people, 3 severe),',
	'gore (0 none, 1 minor injury, 2 blood or wounds, 3 graphic injury or death).',
	'Answer with only JSON, like {"nudity":0,"violence":0,"gore":0}.',
].join(' ')

/** `data_url` is the stripped upload as `data:image/…;base64,…`; the model refuses http URLs. */
export function vision_input(data_url: string) {
	return {
		messages: [
			{
				role: 'user' as const,
				content: [
					{ type: 'text' as const, text: IMAGE_PROMPT },
					{ type: 'image_url' as const, image_url: { url: data_url } },
				],
			},
		],
		max_tokens: 24,
		temperature: 0,
	}
}

const score = (value: unknown) =>
	typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 3
		? value
		: undefined

/** The first JSON object in the model's answer, with all three scores in range, or undefined. */
export function parse_vision(response: unknown): ImageScores | undefined {
	let value = response
	if (typeof value === 'string') {
		const json = value.match(/\{[^{}]*\}/)?.[0]
		if (!json) return undefined
		try {
			value = JSON.parse(json)
		} catch {
			return undefined
		}
	}
	if (!value || typeof value !== 'object') return undefined
	const { nudity, violence, gore } = value as Record<string, unknown>
	const scores = { nudity: score(nudity), violence: score(violence), gore: score(gore) }
	if (scores.nudity === undefined || scores.violence === undefined || scores.gore === undefined)
		return undefined
	return scores as ImageScores
}
