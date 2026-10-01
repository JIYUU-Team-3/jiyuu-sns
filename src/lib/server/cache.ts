/**
 * A JSON value kept in this Cloudflare location's cache for `ttl_seconds`, computed on a miss.
 * The Cache API is free and costs no KV writes (the free plan allows 1,000 a day), at the price of
 * being per location and best effort. Without a cache (unit tests) every call computes.
 */
export async function cached<T>(
	key: string,
	ttl_seconds: number,
	compute: () => Promise<T>,
	/** Whether a computed value is worth keeping; a failed lookup isn't. */
	keep: (value: T) => boolean = () => true,
) {
	const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default
	// The Cache API keys by URL; this host is never fetched, only used as a name.
	const request = new Request(`https://cache.jiyuu.internal/${encodeURIComponent(key)}`)
	const hit = await cache?.match(request)
	if (hit) return (await hit.json()) as T
	const value = await compute()
	if (!keep(value)) return value
	await cache?.put(
		request,
		new Response(JSON.stringify(value), {
			headers: { 'content-type': 'application/json', 'cache-control': `max-age=${ttl_seconds}` },
		}),
	)
	return value
}
