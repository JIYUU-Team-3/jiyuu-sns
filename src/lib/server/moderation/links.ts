import { inArray, sql, type SQLWrapper } from 'drizzle-orm'
import { text_segments } from '#lib/posts/text'
import { cached } from '../cache'
import { chunks } from '../db/chunks'
import type { getDb } from '../db'
import { blockedDomain } from '../db/schema'

type Db = ReturnType<typeof getDb>

/** Most links one post or message may carry. */
export const LINKS_MAX = 5

/** Why a link was refused. Each is also the error the composer turns into a message. */
export type LinkRefusal =
	'link_lookalike' | 'link_address' | 'link_blocked' | 'link_new_account' | 'link_too_many'

/** Hosts that only forward somewhere else, hiding where a link really goes. */
const SHORTENERS = new Set([
	'bit.ly',
	'tinyurl.com',
	't.co',
	'goo.gl',
	'ow.ly',
	'is.gd',
	'buff.ly',
	'cutt.ly',
	'rebrand.ly',
	'shorturl.at',
	'rb.gy',
	'tiny.cc',
	's.id',
	't.ly',
])

/** Files a link can make a browser download and run. */
const EXECUTABLE = /\.(?:exe|apk|scr|bat|cmd|msi|jar|vbs|ps1|js|zip)$/i

/** The host exactly as typed in the post, before any URL parsing turns it into punycode. */
const typed_host = (href: string) =>
	href
		.replace(/^https?:\/\//i, '')
		.split(/[/?#]/, 1)[0]
		.toLowerCase()

const SCRIPTS = ['Latin', 'Cyrillic', 'Greek', 'Armenian', 'Cherokee'] as const

/**
 * A label that mixes alphabets that look alike, like a Cyrillic `а` in `pаypal`, or one typed
 * already in punycode (`xn--`). Hosts written wholly in one script, Japanese included, are fine.
 */
function lookalike(host: string) {
	return host.split('.').some((label) => {
		if (label.startsWith('xn--')) return true
		const used = SCRIPTS.filter((script) => new RegExp(`\\p{Script=${script}}`, 'u').test(label))
		return used.length > 1
	})
}

export type Link = {
	href: string
	/** Lowercase, as the browser would ask DNS for it. */
	host: string
	/** Refused whoever posts it. */
	refusal?: 'link_lookalike' | 'link_address'
	/** Allowed, but noted: a shortener or a file to run. New accounts can't post links at all. */
	risky: boolean
}

/** Every link in a post or message, as `text_segments` would draw it. */
export function links_in(body: string): Link[] {
	return text_segments(body).flatMap((segment) => {
		if (!segment.href) return []
		const typed = typed_host(segment.href)
		let url: URL
		try {
			url = new URL(segment.href)
		} catch {
			return [{ href: segment.href, host: typed, refusal: 'link_address', risky: false }]
		}
		const host = url.hostname.toLowerCase()
		const refusal = lookalike(typed)
			? 'link_lookalike'
			: // A bare address or an unusual port says nothing about who runs the site.
				/^\d+(?:\.\d+){3}$/.test(host) || host.startsWith('[') || url.port !== ''
				? 'link_address'
				: undefined
		const risky = SHORTENERS.has(host) || EXECUTABLE.test(url.pathname)
		return [{ href: segment.href, host, refusal, risky }]
	})
}

/** `a.b.example.com` → `a.b.example.com`, `b.example.com`, `example.com`: a block covers subdomains. */
export function host_and_parents(host: string) {
	const labels = host.split('.')
	return labels.slice(0, -1).map((_, i) => labels.slice(i).join('.'))
}

/** Which of `hosts` are on the blocklist, themselves or through a parent domain. */
export async function blocked_hosts(db: Db, hosts: string[]) {
	const candidates = [...new Set(hosts.flatMap(host_and_parents))]
	if (!candidates.length) return new Set<string>()
	const blocked = new Set<string>()
	for (const part of chunks(candidates)) {
		const rows = await db
			.select({ domain: blockedDomain.domain })
			.from(blockedDomain)
			.where(inArray(blockedDomain.domain, part))
		for (const row of rows) blocked.add(row.domain)
	}
	return new Set(hosts.filter((host) => host_and_parents(host).some((d) => blocked.has(d))))
}

/** Cloudflare's resolver that answers `0.0.0.0` for known malware and phishing domains. */
const SECURITY_DOH = 'https://security.cloudflare-dns.com/dns-query'

export type Reputation = 'blocked' | 'ok' | 'unknown'

/**
 * Ask the security resolver about one host. Only the host name leaves, never the link or the
 * post. One second at most; `unknown` when it can't answer, which the hourly job asks again.
 */
export async function reputation(host: string, fetcher: typeof fetch = fetch): Promise<Reputation> {
	return cached<Reputation>(
		`doh:${host}`,
		24 * 60 * 60,
		async () => {
			try {
				const params = new URLSearchParams({ name: host, type: 'A' })
				const response = await fetcher(`${SECURITY_DOH}?${params}`, {
					headers: { accept: 'application/dns-json' },
					signal: AbortSignal.timeout(1000),
				})
				if (!response.ok) return 'unknown'
				// DNS JSON capitalises its fields; `Answer` holds the records, `Question` echoes the query.
				const answer: unknown = ((await response.json()) as Record<string, unknown>)['Answer']
				const records = (Array.isArray(answer) ? answer : []) as { data?: unknown }[]
				return records.some((record) => record?.data === '0.0.0.0') ? 'blocked' : 'ok'
			} catch {
				return 'unknown'
			}
		},
		(verdict) => verdict !== 'unknown',
	)
}

/** Put a domain on the blocklist; `added_by` is null when a check did it. */
export async function block_domain(
	db: Db,
	domain: string,
	added_by: string | null,
	reason: string,
) {
	await db
		.insert(blockedDomain)
		.values({ domain: domain.toLowerCase(), addedBy: added_by, reason })
		.onConflictDoNothing()
}

export type LinkCheck = {
	refusal?: LinkRefusal
	/** Shorteners and file links that were allowed, for the moderator's flags. */
	risky: string[]
	/** Hosts the resolver couldn't vouch for in time; the hourly job asks again. */
	unknown: string[]
}

/**
 * Check the links in a post or message before it's saved. `can_link` is false for restricted
 * accounts, who can't post links at all; a new account's daily allowance is counted in
 * `write.ts`. A host the resolver reports goes on the
 * blocklist, so every post that already has it stops linking to it too.
 */
export async function check_links(
	db: Db,
	body: string,
	options: {
		can_link: boolean
		fetcher?: typeof fetch
		/** Runs once before any host is looked up, e.g. to count against a rate limit. */
		before_lookup?: () => Promise<void>
	},
): Promise<LinkCheck> {
	const links = links_in(body)
	const none: LinkCheck = { risky: [], unknown: [] }
	if (!links.length) return none
	const refused = links.find((link) => link.refusal)?.refusal
	if (refused) return { ...none, refusal: refused }
	if (links.length > LINKS_MAX) return { ...none, refusal: 'link_too_many' }
	if (!options.can_link) return { ...none, refusal: 'link_new_account' }

	const hosts = [...new Set(links.map((link) => link.host))]
	if ((await blocked_hosts(db, hosts)).size) return { ...none, refusal: 'link_blocked' }
	await options.before_lookup?.()

	const verdicts = await Promise.all(
		hosts.map(async (host) => [host, await reputation(host, options.fetcher)] as const),
	)
	const bad = verdicts.filter(([, verdict]) => verdict === 'blocked').map(([host]) => host)
	for (const host of bad) await block_domain(db, host, null, 'malicious_link')
	return {
		refusal: bad.length ? 'link_blocked' : undefined,
		risky: links.filter((link) => link.risky).map((link) => link.href),
		unknown: verdicts.filter(([, verdict]) => verdict === 'unknown').map(([host]) => host),
	}
}

/**
 * The blocked domains a post's or message's text mentions, as a JSON array, for drawing their
 * links as plain text. Checked when it's read, so blocking a domain disables its old links at
 * once. `instr` over-matches (`evil.com` in `notevil.com`); the client compares hosts exactly.
 */
export const blocked_hosts_in = (body: SQLWrapper) =>
	sql<string>`(select json_group_array(d.domain) from blocked_domain d where instr(lower(${body}), d.domain) > 0)`
