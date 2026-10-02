export const RETRY_DELAYS = [2_000, 8_000]

export async function acknowledge(post: () => Promise<Response>) {
	try {
		const response = await post()
		return response.ok || (response.status < 500 && response.status !== 429)
	} catch {
		return false
	}
}

export async function deliver({
	post,
	wait,
	later,
}: {
	post: () => Promise<Response>
	wait: (ms: number) => Promise<void>
	later?: () => Promise<void>
}) {
	if (await acknowledge(post)) return true
	for (const ms of RETRY_DELAYS) {
		await wait(ms)
		if (await acknowledge(post)) return true
	}
	await later?.().catch(() => {})
	return false
}
