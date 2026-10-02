/** A link's host, lowercase; empty for anything that doesn't parse. */
export function host_of(href: string) {
	try {
		return new URL(href).hostname.toLowerCase()
	} catch {
		return ''
	}
}

/** Whether a link goes to a blocked domain or one of its subdomains. */
export function is_blocked_link(href: string, blocked: readonly string[]) {
	if (!blocked.length) return false
	const host = host_of(href)
	return blocked.some((domain) => host === domain || host.endsWith(`.${domain}`))
}
