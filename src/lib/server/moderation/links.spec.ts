import { describe, expect, it, vi } from 'vitest'
import { blockedDomain } from '../db/schema'
import { test_db } from '../db/test-d1'
import { blocked_hosts, check_links, host_and_parents, links_in, reputation } from './links'

/** A stand-in for Cloudflare's resolver: `0.0.0.0` for hosts in `bad`. */
const resolver = (bad: string[]) =>
	vi.fn(async (input: string | URL | Request) => {
		const name = new URL(String(input)).searchParams.get('name')!
		const data = bad.includes(name) ? '0.0.0.0' : '93.184.216.34'
		// The shape Cloudflare answers with, `Question` first.
		return new Response(
			`{"Status":0,"Question":[{"name":"${name}","type":1}],"Answer":[{"name":"${name}","type":1,"data":"${data}"}]}`,
		)
	}) as unknown as typeof fetch

describe('links_in', () => {
	it('refuses hosts that imitate others or say nothing about who runs them', () => {
		const shapes = (body: string) => links_in(body).map((link) => link.refusal)
		expect(shapes('pay at https://pаypal.com/login')).toEqual(['link_lookalike'])
		expect(shapes('https://xn--pypal-4ve.com')).toEqual(['link_lookalike'])
		expect(shapes('http://45.12.3.9/x')).toEqual(['link_address'])
		expect(shapes('https://example.com:8443/')).toEqual(['link_address'])
		expect(shapes('https://example.com/ok')).toEqual([undefined])
		expect(shapes('https://日本語.jp/')).toEqual([undefined])
	})

	it('notes shorteners and files to run as risky', () => {
		expect(links_in('https://bit.ly/x https://example.com/app.apk https://example.com/a')).toEqual([
			expect.objectContaining({ host: 'bit.ly', risky: true }),
			expect.objectContaining({ host: 'example.com', risky: true }),
			expect.objectContaining({ host: 'example.com', risky: false }),
		])
	})

	it('ignores links the text never draws, such as ones with user info', () => {
		expect(links_in('https://bank.example@evil.example/ no link here')).toEqual([])
	})
})

describe('blocklist', () => {
	it('covers a domain and its subdomains, nothing else', async () => {
		expect(host_and_parents('a.b.example.com')).toEqual([
			'a.b.example.com',
			'b.example.com',
			'example.com',
		])
		const db = test_db()
		await db.insert(blockedDomain).values({ domain: 'evil.example' })
		const blocked = await blocked_hosts(db, ['evil.example', 'cdn.evil.example', 'notevil.example'])
		expect([...blocked].sort((a, b) => a.localeCompare(b))).toEqual([
			'cdn.evil.example',
			'evil.example',
		])
	})
})

describe('blocked_hosts with many hosts', () => {
	it('stays inside D1’s 100-parameter limit', async () => {
		const db = test_db()
		await db.insert(blockedDomain).values({ domain: 'h149.example' })
		const hosts = Array.from({ length: 150 }, (_, i) => `www.h${i}.example`)
		expect([...(await blocked_hosts(db, hosts))]).toEqual(['www.h149.example'])
	})
})

describe('reputation', () => {
	it('reads the resolver’s answer, and says unknown when it fails', async () => {
		expect(await reputation('bad.example', resolver(['bad.example']))).toBe('blocked')
		expect(await reputation('fine.example', resolver([]))).toBe('ok')
		const broken = vi.fn(async () => {
			throw new Error('timeout')
		}) as unknown as typeof fetch
		expect(await reputation('slow.example', broken)).toBe('unknown')
	})
})

describe('check_links', () => {
	it('lets a new account post text without links, and nothing with them', async () => {
		const db = test_db()
		expect(await check_links(db, 'no links here', { can_link: false })).toEqual({
			risky: [],
			unknown: [],
		})
		expect((await check_links(db, 'see https://example.com', { can_link: false })).refusal).toBe(
			'link_new_account',
		)
	})

	it('caps links per post', async () => {
		const body = Array.from({ length: 6 }, (_, i) => `https://s${i}.example.com`).join(' ')
		expect((await check_links(test_db(), body, { can_link: true })).refusal).toBe('link_too_many')
	})

	it('blocks a host the resolver reports, for every later post too', async () => {
		const db = test_db()
		const before_lookup = vi.fn(async () => {})
		const first = await check_links(db, 'https://phish.example/login', {
			can_link: true,
			fetcher: resolver(['phish.example']),
			before_lookup,
		})
		expect(first.refusal).toBe('link_blocked')
		expect(before_lookup).toHaveBeenCalledOnce()
		// Now on the blocklist: refused without asking again.
		const lookup = resolver([])
		const again = await check_links(db, 'https://www.phish.example/', {
			can_link: true,
			fetcher: lookup,
		})
		expect(again.refusal).toBe('link_blocked')
		expect(lookup).not.toHaveBeenCalled()
	})

	it('allows good links and reports risky and unanswered ones', async () => {
		const result = await check_links(test_db(), 'https://bit.ly/a https://ok.example', {
			can_link: true,
			fetcher: resolver([]),
		})
		expect(result).toEqual({ refusal: undefined, risky: ['https://bit.ly/a'], unknown: [] })
	})
})
