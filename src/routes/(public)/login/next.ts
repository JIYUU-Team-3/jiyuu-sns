const ORIGIN = 'https://jiyuu.invalid'

const NEXT_MAX = 2048

export function safe_next(value: unknown) {
	if (typeof value !== 'string' || !value.startsWith('/') || value.length > NEXT_MAX) return
	let url: URL
	try {
		url = new URL(value, ORIGIN)
	} catch {
		return
	}
	if (url.origin !== ORIGIN || url.pathname.startsWith('//')) return
	return url.pathname + url.search
}

export const with_next = (href: string, next: string | undefined) =>
	next ? `${href}?next=${encodeURIComponent(next)}` : href
