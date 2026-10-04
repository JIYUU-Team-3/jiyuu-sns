/*
 * Caching on the Workers Free plan. KV allows 1,000 writes a day for the whole app, so it only
 * holds what must be the same everywhere and changes a few times a day (the hourly job's cursor).
 * Everything else goes in the Cache API: free, unlimited, but per Cloudflare location and best
 * effort, so a value is only ever a copy of what D1 can compute again.
 */

const cache_of = () => (globalThis as { caches?: { default?: Cache } }).caches?.default

// The Cache API keys by URL; this host is never fetched, only used as a name.
const cache_request = (key: string) =>
	new Request(`https://cache.jiyuu.internal/${encodeURIComponent(key)}`)

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
	const cache = cache_of()
	const request = cache_request(key)
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

/**
 * Whether `key` was marked in this location within `ttl_seconds`, marking it now if not. For
 * keeping repeats quiet, where a miss in another location only lets one more through.
 */
export async function seen_recently(key: string, ttl_seconds: number) {
	const cache = cache_of()
	if (!cache) return false
	const request = cache_request(key)
	if (await cache.match(request)) return true
	await cache.put(
		request,
		new Response('1', { headers: { 'cache-control': `max-age=${ttl_seconds}` } }),
	)
	return false
}
