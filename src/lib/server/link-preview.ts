import { eq } from 'drizzle-orm'
import { sniff_image } from '#lib/media'
import { clean_text } from '#lib/posts/clean'
import { text_segments } from '#lib/posts/text'
import type { LinkPreview } from '#lib/posts/types'
import type { getDb } from './db'
import { linkPreview } from './db/schema'
import { image_size } from './image-size'
import { delete_media, media_url } from './media'
import { blocked_hosts, reputation } from './moderation/links'
import { strip_metadata } from './strip-metadata'

type Db = ReturnType<typeof getDb>

/*
 * Link previews: the server reads the linked page's Open Graph tags once and keeps a copy of its
 * picture in R2, so a reader's browser never reaches the site, and a URL a person typed is never
 * an image the browser loads. Every request, redirects and the picture included, goes only to a
 * plain `http(s)` host that the link checks would let a post link to.
 */

/** A page with a card is read again after this long; one without, sooner. */
export const REFRESH_AFTER = 7 * 24 * 60 * 60 * 1000
export const RETRY_AFTER = 24 * 60 * 60 * 1000

/** Each request's limits. A page's tags are in its head, well inside the first bytes. */
const TIMEOUT_MS = 3000
const PAGE_MAX_BYTES = 512 * 1024
export const IMAGE_MAX_BYTES = 3 * 1024 * 1024
const REDIRECTS_MAX = 3
/** Smaller is an icon or a tracking pixel, not a picture worth a card. */
const IMAGE_MIN_PIXELS = 64

const URL_MAX = 2048
const TITLE_MAX = 200
const DESCRIPTION_MAX = 300
const SITE_MAX = 80

/**
 * Sites answer link-preview bots with their tags; some send others to a sign-in or script page.
 * It names no person or post, only that Jiyuu is asking.
 */
const USER_AGENT = 'Mozilla/5.0 (compatible; JiyuuBot/1.0; link preview)'

export type PreviewDeps = { bucket: R2Bucket; fetcher?: typeof fetch }

/** The link a post's card is for: its first, or undefined when it has none worth fetching. */
export function preview_link(body: string) {
	const href = text_segments(body).find((segment) => segment.href)?.href
	return href && href.length <= URL_MAX && public_url(href) ? href : undefined
}

/**
 * A URL only when it's `http(s)` to a named public host on the default port, with no user name
 * in it: the same shape a post may link to, re-checked here for every redirect.
 */
export function public_url(href: string) {
	let url: URL
	try {
		url = new URL(href)
	} catch {
		return undefined
	}
	const host = url.hostname.toLowerCase()
	if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined
	if (url.username || url.password || url.port) return undefined
	// Addresses, single labels (`localhost`, an intranet name) and private suffixes name no site.
	if (/^\d+(?:\.\d+){3}$/.test(host) || host.startsWith('[') || !host.includes('.'))
		return undefined
	if (/\.(?:local|localhost|internal|lan|home|arpa|test|example|invalid)$/.test(host))
		return undefined
	return url
}

/** A public URL whose host isn't blocked here or by Cloudflare's security resolver. */
async function allowed(db: Db, href: string, fetcher: typeof fetch) {
	const url = public_url(href)
	if (!url) return undefined
	const host = url.hostname.toLowerCase()
	if ((await blocked_hosts(db, [host])).size) return undefined
	if ((await reputation(host, fetcher)) === 'blocked') return undefined
	return url
}

/** Drop a body we won't read, without waiting for the other end. */
const discard = (response: Response) => void response.body?.cancel().catch(() => {})

/** Fetch `href`, following up to `REDIRECTS_MAX` redirects, each to an allowed host. */
async function fetch_allowed(db: Db, href: string, accept: string, fetcher: typeof fetch) {
	let next = href
	for (let hop = 0; hop <= REDIRECTS_MAX; hop++) {
		const url = await allowed(db, next, fetcher)
		if (!url) return undefined
		const response = await fetcher(url.href, {
			redirect: 'manual',
			headers: { 'user-agent': USER_AGENT, accept, 'accept-language': 'en, ja;q=0.8, km;q=0.6' },
			signal: AbortSignal.timeout(TIMEOUT_MS),
		})
		const location = response.headers.get('location')
		if (response.status >= 300 && response.status < 400 && location) {
			discard(response)
			next = new URL(location, url).href
			continue
		}
		if (!response.ok) {
			discard(response)
			return undefined
		}
		return { response, url }
	}
	return undefined
}

/** Up to `max` bytes of the body; undefined past `max` when `whole` is asked for. */
async function read_bytes(response: Response, max: number, whole: boolean) {
	const reader = response.body?.getReader()
	if (!reader) return undefined
	const parts: Uint8Array[] = []
	let length = 0
	for (;;) {
		const { done, value } = await reader.read()
		if (done) break
		parts.push(value)
		length += value.length
		if (length >= max) {
			reader.cancel().catch(() => {})
			if (whole && length > max) return undefined
			break
		}
	}
	const bytes = new Uint8Array(Math.min(length, max))
	let at = 0
	for (const part of parts) {
		const take = part.subarray(0, bytes.length - at)
		bytes.set(take, at)
		at += take.length
	}
	return bytes
}

const ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: ' ',
}

function decode_entities(text: string) {
	return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, name: string) => {
		if (name[0] !== '#') return ENTITIES[name.toLowerCase()] ?? match
		const code =
			name[1] === 'x' || name[1] === 'X'
				? Number.parseInt(name.slice(2), 16)
				: Number(name.slice(1))
		return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match
	})
}

/** Page text as a card shows it: one line, cleaned like post text, and cut to `max` characters. */
function card_text(raw: string | undefined, max: number) {
	if (!raw) return undefined
	const text = clean_text(decode_entities(raw)).replace(/\s+/g, ' ').trim()
	if (!text) return undefined
	const chars = [...text]
	return chars.length > max
		? `${chars
				.slice(0, max - 1)
				.join('')
				.trimEnd()}…`
		: text
}

const NAME = /[\w:-]+/y
const SPACE = /\s*/y
const BARE = /[^\s"'>]+/y

/**
 * A tag's `name="value"` pairs, lowercase names. One pass left to right, never going back, so a
 * hostile page can't make it slow: a regex over the whole tag would retry from every character.
 */
export function attributes(tag: string) {
	const values = new Map<string, string>()
	let at = 0
	const take = (pattern: RegExp) => {
		pattern.lastIndex = at
		const found = pattern.exec(tag)
		if (found) at = pattern.lastIndex
		return found?.[0]
	}
	while (at < tag.length) {
		const name = take(NAME)
		if (!name) {
			at += 1
			continue
		}
		take(SPACE)
		if (tag[at] !== '=') continue
		at += 1
		take(SPACE)
		const quote = tag[at]
		if (quote === '"' || quote === "'") {
			const end = tag.indexOf(quote, at + 1)
			// An unclosed quote runs to the end of the tag; nothing after it is an attribute.
			if (end === -1) break
			values.set(name.toLowerCase(), tag.slice(at + 1, end))
			at = end + 1
		} else {
			const bare = take(BARE)
			if (bare) values.set(name.toLowerCase(), bare)
		}
	}
	return values
}

/** The `<meta>` tags and `<title>` in a page's head, as a card needs them. */
export function page_tags(html: string) {
	const end = html.search(/<\/head\s*>/i)
	const head = end === -1 ? html : html.slice(0, end)
	const meta = new Map<string, string>()
	for (const [, tag] of head.matchAll(/<meta\b([^>]*)>/gi)) {
		const values = attributes(tag)
		const key = (values.get('property') ?? values.get('name'))?.toLowerCase()
		const content = values.get('content')
		// The first of a repeated tag wins, as it does for the sites' own previews.
		if (key && content !== undefined && !meta.has(key)) meta.set(key, content)
	}
	const pick = (...keys: string[]) => keys.map((key) => meta.get(key)?.trim()).find(Boolean)
	return {
		title: card_text(
			pick('og:title', 'twitter:title') ?? head.match(/<title[^>]*>([^<]*)</i)?.[1],
			TITLE_MAX,
		),
		description: card_text(
			pick('og:description', 'twitter:description', 'description'),
			DESCRIPTION_MAX,
		),
		site_name: card_text(pick('og:site_name', 'application-name'), SITE_MAX),
		image: pick(
			'og:image:secure_url',
			'og:image',
			'og:image:url',
			'twitter:image',
			'twitter:image:src',
		),
	}
}

function charset(response: Response) {
	const match = response.headers.get('content-type')?.match(/charset=["']?([\w-]+)/i)
	try {
		return new TextDecoder(match?.[1] ?? 'utf-8')
	} catch {
		return new TextDecoder('utf-8')
	}
}

/** The page's picture, cleaned of metadata and stored in R2 under the link; undefined if unusable. */
async function copy_image(db: Db, deps: PreviewDeps, page_url: URL, src: string, link: string) {
	let href: string
	try {
		href = new URL(decode_entities(src), page_url).href
	} catch {
		return undefined
	}
	const fetcher = deps.fetcher ?? fetch
	const fetched = await fetch_allowed(db, href, 'image/*', fetcher)
	if (!fetched) return undefined
	const declared = Number(fetched.response.headers.get('content-length'))
	if (declared > IMAGE_MAX_BYTES) {
		discard(fetched.response)
		return undefined
	}
	const bytes = await read_bytes(fetched.response, IMAGE_MAX_BYTES, true)
	const type = bytes && sniff_image(bytes.subarray(0, 12))
	if (!bytes || !type) return undefined
	const size = image_size(bytes, type.type)
	if (!size || size.width < IMAGE_MIN_PIXELS || size.height < IMAGE_MIN_PIXELS) return undefined
	if (size.width > 20_000 || size.height > 20_000) return undefined
	// Throws for a file it can't take apart, which is then no picture rather than an unclean one.
	const clean = strip_metadata(bytes.buffer.slice(0, bytes.length) as ArrayBuffer, type.type)
	const key = `links/${await url_hash(link)}/${crypto.randomUUID()}.${type.ext}`
	await deps.bucket.put(key, clean, { httpMetadata: { contentType: type.type } })
	return { url: media_url(key), ...size }
}

async function url_hash(url: string) {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(url))
	return [...new Uint8Array(digest).subarray(0, 8)]
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('')
}

type Fetched = Omit<LinkPreview, 'url' | 'title'> & { title?: string }

/** Read the page and copy its picture. Never throws: a page that fails has no card. */
async function fetch_preview(db: Db, deps: PreviewDeps, link: string): Promise<Fetched> {
	try {
		const fetched = await fetch_allowed(
			db,
			link,
			'text/html,application/xhtml+xml',
			deps.fetcher ?? fetch,
		)
		if (!fetched) return {}
		const type = fetched.response.headers.get('content-type') ?? ''
		if (!/^\s*(?:text\/html|application\/xhtml\+xml)/i.test(type)) {
			discard(fetched.response)
			return {}
		}
		const bytes = await read_bytes(fetched.response, PAGE_MAX_BYTES, false)
		if (!bytes) return {}
		const tags = page_tags(charset(fetched.response).decode(bytes))
		if (!tags.title) return {}
		const image = tags.image
			? await copy_image(db, deps, fetched.url, tags.image, link).catch(() => undefined)
			: undefined
		return {
			title: tags.title,
			description: tags.description,
			site_name: tags.site_name,
			image,
		}
	} catch {
		return {}
	}
}

type Row = typeof linkPreview.$inferSelect

export function to_preview(
	row: Pick<
		Row,
		'url' | 'title' | 'description' | 'siteName' | 'image' | 'imageWidth' | 'imageHeight'
	>,
): LinkPreview | undefined {
	if (!row.title) return undefined
	return {
		url: row.url,
		title: row.title,
		description: row.description ?? undefined,
		site_name: row.siteName ?? undefined,
		image:
			row.image && row.imageWidth && row.imageHeight
				? { url: row.image, width: row.imageWidth, height: row.imageHeight }
				: undefined,
	}
}

/**
 * The card for `link`: the stored one while it's fresh, otherwise read from the page now and
 * stored for every post with that link. Undefined when the page has nothing to show.
 */
export async function ensure_preview(db: Db, deps: PreviewDeps, link: string) {
	const [row] = await db.select().from(linkPreview).where(eq(linkPreview.url, link)).limit(1)
	if (row) {
		const age = Date.now() - row.fetchedAt.getTime()
		if (age < (row.title ? REFRESH_AFTER : RETRY_AFTER)) return to_preview(row)
	}
	const fetched = await fetch_preview(db, deps, link)
	const values = {
		title: fetched.title ?? null,
		description: fetched.description ?? null,
		siteName: fetched.site_name ?? null,
		image: fetched.image?.url ?? null,
		imageWidth: fetched.image?.width ?? null,
		imageHeight: fetched.image?.height ?? null,
		fetchedAt: new Date(),
	}
	await db
		.insert(linkPreview)
		.values({ url: link, ...values })
		.onConflictDoUpdate({ target: linkPreview.url, set: values })
	if (row?.image) await delete_media(deps.bucket, [row.image])
	return to_preview({ url: link, ...values })
}
