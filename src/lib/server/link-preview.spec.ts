import { beforeEach, describe, expect, it } from 'vitest'
import { linkPreview } from './db/schema'
import { add_account, test_db, type TestDb } from './db/test-d1'
import { image_size } from './image-size'
import {
	attributes,
	ensure_preview,
	IMAGE_MAX_BYTES,
	page_tags,
	preview_link,
	public_url,
	RETRY_AFTER,
} from './link-preview'
import { block_domain } from './moderation/links'
import { find_post, insert_post, update_post } from './posts'

const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0))

/** A PNG chunk; the CRC isn't checked, so it's left zero. */
const chunk = (type: string, data: number[] = []) => [
	0,
	0,
	data.length >> 8,
	data.length & 0xff,
	...ascii(type),
	...data,
	0,
	0,
	0,
	0,
]
const be32 = (n: number) => [(n >>> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]

/** A PNG of `width` by `height` carrying an author's name in a text chunk. */
const png = (width = 1200, height = 630) =>
	new Uint8Array([
		0x89,
		0x50,
		0x4e,
		0x47,
		0x0d,
		0x0a,
		0x1a,
		0x0a,
		...chunk('IHDR', [...be32(width), ...be32(height), 8, 6, 0, 0, 0]),
		...chunk('tEXt', ascii('Author\0Jane Doe')),
		...chunk('IDAT', [1, 2, 3]),
		...chunk('IEND'),
	])

const page = (head: string) =>
	`<!doctype html><html><head>${head}</head><body>${'x'.repeat(100)}</body></html>`

type Route = (url: URL) => Response | undefined

/**
 * A fake internet: Cloudflare's security resolver answers every host as clean unless it's in
 * `malicious`, and `routes` answers the rest. Every URL asked for is recorded.
 */
function web(routes: Record<string, Route | Response>, malicious: string[] = []) {
	const asked: string[] = []
	const fetcher = (async (input: RequestInfo | URL) => {
		const url = new URL(String(input))
		if (url.hostname === 'security.cloudflare-dns.com') {
			const name = url.searchParams.get('name') ?? ''
			const data = malicious.includes(name) ? '0.0.0.0' : '93.184.216.34'
			return new Response(`{"Status":0,"Answer":[{"data":"${data}"}]}`)
		}
		asked.push(url.href)
		const route = routes[url.href]
		const response = typeof route === 'function' ? route(url) : route
		return response?.clone() ?? new Response('not found', { status: 404 })
	}) as typeof fetch
	return { fetcher, asked }
}

const html = (body: string) =>
	new Response(body, { headers: { 'content-type': 'text/html; charset=utf-8' } })
const image = (bytes: Uint8Array) =>
	new Response(bytes as Uint8Array<ArrayBuffer>, { headers: { 'content-type': 'image/png' } })
const redirect = (to: string) => new Response(null, { status: 302, headers: { location: to } })

function bucket() {
	const objects = new Map<string, Uint8Array>()
	return {
		objects,
		bucket: {
			put: async (key: string, value: ArrayBuffer) => void objects.set(key, new Uint8Array(value)),
			delete: async (keys: string[]) => keys.forEach((key) => objects.delete(key)),
		} as unknown as R2Bucket,
	}
}

describe('page_tags', () => {
	it('reads Open Graph tags first, then Twitter ones, then the title and description', () => {
		expect(
			page_tags(
				page(`<title>Plain title</title>
				<meta property="og:title" content="OG &amp; title">
				<meta name='twitter:title' content='Twitter title'>
				<meta name="description" content="Plain &#8220;description&#8221;">
				<meta property="og:site_name" content="Example">
				<meta content="/img.png" property="og:image">`),
			),
		).toEqual({
			title: 'OG & title',
			description: 'Plain “description”',
			site_name: 'Example',
			image: '/img.png',
		})
		expect(page_tags(page('<title> Only\n a  title </title>'))).toMatchObject({
			title: 'Only a title',
			description: undefined,
			image: undefined,
		})
	})

	it('cleans what it reads like post text, and cuts it short', () => {
		const tags = page_tags(
			page(
				`<meta property="og:title" content="a\u202eb">` +
					`<meta property="og:description" content="${'word '.repeat(200)}">`,
			),
		)
		expect(tags.title).toBe('ab')
		expect([...tags.description!].length).toBe(300)
		expect(tags.description!.endsWith('…')).toBe(true)
	})

	it('reads attributes in any quoting, and stops at an unclosed quote', () => {
		expect(attributes(` property="og:title" content='It' x=bare data-Y = "z" `)).toEqual(
			new Map([
				['property', 'og:title'],
				['content', 'It'],
				['x', 'bare'],
				['data-y', 'z'],
			]),
		)
		expect(attributes(` a="1" b="never closed c=3`)).toEqual(new Map([['a', '1']]))
	})

	it('stays fast on a page built to make a parser backtrack', () => {
		const started = performance.now()
		page_tags(`<head><meta ${'a'.repeat(500_000)}>`)
		page_tags(`<head><meta ${'a="'.repeat(150_000)}>`)
		page_tags(`<head><meta ${'a ='.repeat(150_000)}>`)
		expect(performance.now() - started).toBeLessThan(500)
	})

	it('ignores tags after the head', () => {
		expect(
			page_tags(`<head><title>Head</title></head><body><meta property="og:title" content="x">`),
		).toMatchObject({ title: 'Head' })
	})
})

describe('public_url', () => {
	it('takes only http(s) links to named public hosts on the default port', () => {
		expect(public_url('https://example.com/a?b')?.href).toBe('https://example.com/a?b')
		for (const href of [
			'ftp://example.com/',
			'javascript:alert(1)',
			'https://127.0.0.1/',
			'http://169.254.169.254/latest/meta-data',
			'https://[::1]/',
			'https://localhost/',
			'https://intranet/',
			'https://printer.local/',
			'https://docs.example/',
			'https://metadata.google.internal/',
			'https://example.com:8080/',
			'https://user:pass@example.com/',
		]) {
			expect(public_url(href), href).toBeUndefined()
		}
	})

	it('finds the first link a post could carry', () => {
		expect(preview_link('see https://example.com/a and https://other.com')).toBe(
			'https://example.com/a',
		)
		expect(preview_link('no links here')).toBeUndefined()
	})
})

describe('image_size', () => {
	it('reads the size from a PNG header', () => {
		expect(image_size(png(1200, 630), 'image/png')).toEqual({ width: 1200, height: 630 })
		expect(image_size(new Uint8Array(10), 'image/png')).toBeUndefined()
	})
})

describe('ensure_preview', () => {
	let db: TestDb
	beforeEach(() => {
		db = test_db()
	})

	const ARTICLE = 'https://news.example.com/story'
	const article = html(
		page(
			'<meta property="og:title" content="A story"><meta property="og:description" content="What happened">' +
				'<meta property="og:site_name" content="News"><meta property="og:image" content="/cover.png">',
		),
	)

	it('stores the card and a copy of the picture without its metadata', async () => {
		const { fetcher } = web({
			[ARTICLE]: article,
			'https://news.example.com/cover.png': image(png()),
		})
		const r2 = bucket()
		const preview = await ensure_preview(db, { bucket: r2.bucket, fetcher }, ARTICLE)
		expect(preview).toMatchObject({
			url: ARTICLE,
			title: 'A story',
			description: 'What happened',
			site_name: 'News',
			image: { width: 1200, height: 630 },
		})
		expect(preview!.image!.url).toMatch(/^\/media\/links\/[0-9a-f]{16}\/[\w-]+\.png$/)
		const [stored] = [...r2.objects.values()]
		expect(String.fromCharCode(...stored)).not.toContain('Jane')
	})

	it('reads a page once and serves the stored card after', async () => {
		const { fetcher, asked } = web({ [ARTICLE]: article })
		const deps = { bucket: bucket().bucket, fetcher }
		await ensure_preview(db, deps, ARTICLE)
		await ensure_preview(db, deps, ARTICLE)
		expect(asked.filter((url) => url === ARTICLE)).toHaveLength(1)
	})

	it('remembers a page with nothing to show, and asks again a day later', async () => {
		const { fetcher, asked } = web({ [ARTICLE]: html('<p>no head</p>') })
		const deps = { bucket: bucket().bucket, fetcher }
		expect(await ensure_preview(db, deps, ARTICLE)).toBeUndefined()
		expect(await ensure_preview(db, deps, ARTICLE)).toBeUndefined()
		expect(asked).toHaveLength(1)
		await db.update(linkPreview).set({ fetchedAt: new Date(Date.now() - RETRY_AFTER - 1) })
		await ensure_preview(db, deps, ARTICLE)
		expect(asked).toHaveLength(2)
	})

	it('follows a redirect to another public site', async () => {
		const { fetcher } = web({
			'https://short.example.com/x': redirect(ARTICLE),
			[ARTICLE]: article,
		})
		expect(
			await ensure_preview(db, { bucket: bucket().bucket, fetcher }, 'https://short.example.com/x'),
		).toMatchObject({ title: 'A story' })
	})

	it('never follows a redirect to an address, a private host or a blocked domain', async () => {
		await block_domain(db, 'evil.example', null, 'test')
		for (const target of [
			'http://169.254.169.254/latest/meta-data',
			'http://localhost/admin',
			'https://phish.evil.example/',
			'https://flagged.example/',
		]) {
			const { fetcher, asked } = web(
				{ 'https://start.example.com/': redirect(target), [target]: article },
				['flagged.example'],
			)
			const deps = { bucket: bucket().bucket, fetcher }
			expect(await ensure_preview(db, deps, 'https://start.example.com/'), target).toBeUndefined()
			expect(asked).not.toContain(target)
			await db.delete(linkPreview)
		}
	})

	it('stops after three redirects', async () => {
		const hops = ['a', 'b', 'c', 'd', 'e'].map((name) => `https://${name}.example.com/`)
		const routes = Object.fromEntries(
			hops.slice(0, -1).map((hop, i) => [hop, redirect(hops[i + 1])]),
		)
		const { fetcher, asked } = web({ ...routes, [hops[4]]: article })
		expect(await ensure_preview(db, { bucket: bucket().bucket, fetcher }, hops[0])).toBeUndefined()
		expect(asked).not.toContain(hops[4])
	})

	it('takes no picture from a blocked or private host, nor one too large or not an image', async () => {
		await block_domain(db, 'evil.example', null, 'test')
		for (const [src, response] of [
			['https://cdn.evil.example/a.png', image(png())],
			['http://10.0.0.1/a.png', image(png())],
			['https://news.example.com/big.png', image(new Uint8Array(IMAGE_MAX_BYTES + 1))],
			['https://news.example.com/page.png', html('<svg onload=alert(1)>')],
			['https://news.example.com/tiny.png', image(png(1, 1))],
		] as const) {
			const { fetcher, asked } = web({
				[ARTICLE]: html(
					page(`<meta property="og:title" content="T"><meta property="og:image" content="${src}">`),
				),
				[src]: response,
			})
			const r2 = bucket()
			const preview = await ensure_preview(db, { bucket: r2.bucket, fetcher }, ARTICLE)
			expect(preview, src).toMatchObject({ title: 'T' })
			expect(preview!.image, src).toBeUndefined()
			expect(r2.objects.size, src).toBe(0)
			if (src.includes('evil') || src.includes('10.0.0.1')) expect(asked).not.toContain(src)
			await db.delete(linkPreview)
		}
	})

	it('reads tags far into a large head, as on a YouTube video page', async () => {
		const script = `<script>var data = "${'x'.repeat(700 * 1024)}"</script>`
		const { fetcher } = web({
			[ARTICLE]: html(page(`${script}<meta property="og:title" content="A video">`)),
		})
		expect(await ensure_preview(db, { bucket: bucket().bucket, fetcher }, ARTICLE)).toMatchObject({
			title: 'A video',
		})
	})

	it('stops reading where the head ends', async () => {
		const encoder = new TextEncoder()
		const { fetcher } = web({
			// The body never finishes, as a slow or endless page wouldn't.
			[ARTICLE]: () =>
				new Response(
					new ReadableStream({
						start(controller) {
							controller.enqueue(encoder.encode('<html><head><title>Slow</title></he'))
							controller.enqueue(encoder.encode('ad><body>'))
						},
					}),
					{ headers: { 'content-type': 'text/html' } },
				),
		})
		expect(await ensure_preview(db, { bucket: bucket().bucket, fetcher }, ARTICLE)).toMatchObject({
			title: 'Slow',
		})
	})

	it('reads only pages, not files', async () => {
		const { fetcher } = web({
			[ARTICLE]: new Response('%PDF-1.7', { headers: { 'content-type': 'application/pdf' } }),
		})
		expect(await ensure_preview(db, { bucket: bucket().bucket, fetcher }, ARTICLE)).toBeUndefined()
	})
})

describe('a post’s link card', () => {
	let db: TestDb
	const LINK = 'https://news.example.com/story'
	beforeEach(async () => {
		db = test_db()
		await add_account(db, 'alice')
		await add_account(db, 'bob')
		await db.insert(linkPreview).values({ url: LINK, title: 'A story', siteName: 'News' })
	})

	const card = async (id: string) => (await find_post(db, 'bob', id))?.link

	it('shows the card for the post’s first link', async () => {
		const id = await insert_post(db, 'alice', { body: `read ${LINK}`, media: [] }, undefined)
		expect(await card(id as string)).toEqual({ url: LINK, title: 'A story', site_name: 'News' })
	})

	it('drops the card once the domain is blocked', async () => {
		const id = await insert_post(db, 'alice', { body: `read ${LINK}`, media: [] }, undefined)
		await block_domain(db, 'example.com', null, 'test')
		expect(await card(id as string)).toBeUndefined()
	})

	it('keeps a card the author took off away through edits, until the link changes', async () => {
		const body = `read ${LINK}`
		const input = { body, media: [], link_preview: false }
		const id = (await insert_post(db, 'alice', input, undefined)) as string
		expect(await card(id)).toBeUndefined()
		await update_post(db, 'alice', id, `${body} today`)
		expect(await card(id)).toBeUndefined()
		await db.insert(linkPreview).values({ url: 'https://other.example.com/', title: 'Other' })
		await update_post(db, 'alice', id, 'now https://other.example.com/')
		expect(await card(id)).toMatchObject({ title: 'Other' })
	})
})
