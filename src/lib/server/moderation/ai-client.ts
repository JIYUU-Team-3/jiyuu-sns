import { WORKERS_AI_ACCOUNT_ID, WORKERS_AI_TOKEN } from '$app/env/private'
import type { Usage } from './ai'

/** Whether the automatic checks are on: both secrets set. Off in development and e2e. */
export const ai_enabled = () => !!WORKERS_AI_ACCOUNT_ID && !!WORKERS_AI_TOKEN

/** Workers AI refused because the day's free allocation is spent. */
export class QuotaError extends Error {}

export type AiAnswer = { response?: unknown; usage?: Usage }

/**
 * Run one model over Workers AI's REST API. A binding would need a Cloudflare login under
 * `wrangler dev --local`, which the e2e server runs without; the API needs only the two secrets.
 */
export async function run_model(
	model: string,
	input: unknown,
	fetcher: typeof fetch = fetch,
): Promise<AiAnswer> {
	const response = await fetcher(
		`https://api.cloudflare.com/client/v4/accounts/${WORKERS_AI_ACCOUNT_ID}/ai/run/${model}`,
		{
			method: 'POST',
			headers: {
				authorization: `Bearer ${WORKERS_AI_TOKEN}`,
				'content-type': 'application/json',
			},
			body: JSON.stringify(input),
			signal: AbortSignal.timeout(15_000),
		},
	)
	const body = (await response.json().catch(() => ({}))) as {
		success?: boolean
		errors?: { code?: number; message?: string }[]
		result?: AiAnswer
	}
	// 4006: "you have used up your daily free allocation of 10,000 neurons".
	if (body.errors?.some((error) => error.code === 4006)) throw new QuotaError()
	if (!response.ok || !body.success) throw new Error(`Workers AI ${response.status}`)
	return body.result ?? {}
}
