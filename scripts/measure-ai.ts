/**
 * Run the moderation checks against real Workers AI and report how often they agree with a
 * moderator and how many neurons each call costs, so the daily budget in `src/lib/server/
 * moderation/budget.ts` can be set from measurements instead of guesses. Phase 0 of
 * docs/MODERATION.md.
 *
 *   pnpm ai:measure                     the English text set in scripts/ai-test-set.ts
 *   pnpm ai:measure --images <folder>   also every image in <folder>/fine and <folder>/harmful
 *   pnpm ai:measure --agree             accept Meta's Llama 3.2 license, once per account
 *
 * Needs WORKERS_AI_ACCOUNT_ID and WORKERS_AI_TOKEN (a token with "Workers AI: Read" and "Edit"),
 * the same two the app uses; `pnpm ai:measure` reads them from `.env`.
 * Every call counts against the account's 10,000 free neurons a day, the same allocation the
 * deployed app uses: the text set costs about 300 neurons. Images are never committed: keep the
 * folder outside the repository.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import {
	DAILY_NEURONS,
	guard_input,
	MODELS,
	neurons,
	parse_guard,
	parse_vision,
	vision_input,
	type Usage,
} from '../src/lib/server/moderation/ai.ts'
import { TEXT_SAMPLES } from './ai-test-set.ts'

const { WORKERS_AI_ACCOUNT_ID, WORKERS_AI_TOKEN } = process.env

async function run(model: string, input: unknown) {
	const response = await fetch(
		`https://api.cloudflare.com/client/v4/accounts/${WORKERS_AI_ACCOUNT_ID}/ai/run/${model}`,
		{
			method: 'POST',
			headers: {
				authorization: `Bearer ${WORKERS_AI_TOKEN}`,
				'content-type': 'application/json',
			},
			body: JSON.stringify(input),
		},
	)
	const body = (await response.json()) as {
		success: boolean
		errors?: { message?: string }[]
		result?: { response?: unknown; usage?: Usage }
	}
	if (!response.ok || !body.success) {
		throw new Error(body.errors?.map((e) => e.message).join('; ') || `HTTP ${response.status}`)
	}
	return body.result ?? {}
}

const args = process.argv.slice(2)

type Tally = { right: number; wrong: number; unreadable: number; neurons: number; calls: number }
const tally = (): Tally => ({ right: 0, wrong: 0, unreadable: 0, neurons: 0, calls: 0 })

function report(name: string, t: Tally, budget: number) {
	const per_call = t.calls ? t.neurons / t.calls : 0
	console.log(
		`\n${name}: ${t.right} right, ${t.wrong} wrong, ${t.unreadable} unreadable answers.` +
			`\n  ${per_call.toFixed(1)} neurons a call on average;` +
			` a budget of ${budget} neurons covers about ${per_call ? Math.floor(budget / per_call) : '∞'} a day.`,
	)
}

async function measure() {
	const text = tally()
	for (const sample of TEXT_SAMPLES) {
		const result = await run(MODELS.text.id, guard_input(sample.text))
		text.calls += 1
		text.neurons += neurons('text', result.usage)
		const verdict = parse_guard(result.response)
		if (!verdict) {
			text.unreadable += 1
			console.log(`?  ${sample.note}: unreadable answer ${JSON.stringify(result.response)}`)
			continue
		}
		const caught = !verdict.safe
		const right = caught === sample.harmful
		text[right ? 'right' : 'wrong'] += 1
		console.log(
			`${right ? '✓' : '✗'}  ${sample.note}: ${caught ? `unsafe ${verdict.categories.join(',')}` : 'safe'}`,
		)
	}
	report('Text (Llama Guard)', text, DAILY_NEURONS.text)

	const folder = args[args.indexOf('--images') + 1]
	if (args.includes('--images') && folder) {
		const types: Record<string, string> = {
			'.jpg': 'image/jpeg',
			'.jpeg': 'image/jpeg',
			'.png': 'image/png',
			'.webp': 'image/webp',
		}
		const images = tally()
		for (const label of ['fine', 'harmful'] as const) {
			const dir = join(folder, label)
			for (const name of readdirSync(dir)) {
				const type = types[extname(name).toLowerCase()]
				if (!type) continue
				const data_url = `data:${type};base64,${readFileSync(join(dir, name)).toString('base64')}`
				const result = await run(MODELS.image.id, vision_input(data_url))
				images.calls += 1
				images.neurons += neurons('image', result.usage)
				const scores = parse_vision(result.response)
				if (!scores) {
					images.unreadable += 1
					console.log(`?  ${label}/${name}: unreadable answer`)
					continue
				}
				// Score 3 on any scale is what the app treats as harmful; 2 only blurs.
				const caught = Math.max(scores.nudity, scores.violence, scores.gore) >= 3
				const right = caught === (label === 'harmful')
				images[right ? 'right' : 'wrong'] += 1
				console.log(`${right ? '✓' : '✗'}  ${label}/${name}: ${JSON.stringify(scores)}`)
			}
		}
		report('Images (Llama 3.2 Vision)', images, DAILY_NEURONS.image)
	}
}

// No `process.exit` anywhere here: on Windows it crashes Node on the way out.
if (!WORKERS_AI_ACCOUNT_ID || !WORKERS_AI_TOKEN) {
	console.error('Set WORKERS_AI_ACCOUNT_ID and WORKERS_AI_TOKEN in .env first.')
	process.exitCode = 1
} else if (args.includes('--agree')) {
	await run(MODELS.image.id, { prompt: 'agree' })
	console.log('Accepted the Llama 3.2 license for this account.')
} else {
	await measure()
}
