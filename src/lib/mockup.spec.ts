import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import { spawnSync } from 'node:child_process'

const repo = resolve(import.meta.dirname, '../..')
const mockupFile = join(repo, 'design/mockup/index.html')
const screenshotScript = join(repo, '.claude/skills/mockup-screenshots/shoot.mjs')

type Draft = {
	text: string
	images: string[]
	gif: string | null
	poll: { opts: string[] } | null
}

type Mockup = {
	location: { hash: string }
	state: {
		following: Set<string>
		requested: Set<string>
		revealed: Set<string>
		votes: Record<string, number>
	}
	posts: Array<{
		id: string
		by: string
		text: string
		c: { r: number }
		poll?: { opts: Array<[string, number]> }
		thread?: string
		replyTo?: string
		edited?: boolean
		repostedBy?: string
	}>
	handleStatus: (value: string) => [string, string]
	parseRoute: () => { name: string; args: string[]; q: URLSearchParams }
	richText: (text: string) => string
	feedPosts: (tab: string) => Array<{ id: string }>
	renderPost: (post: unknown) => string
	renderPoll: (post: unknown) => string
	canReply: (post: { by: string; text: string; replyCtl?: string }) => boolean
	newDraft: (text?: string) => Draft
	setComposer: (drafts: Draft[], mode?: string, target?: string) => void
	composerValid: () => boolean
	submitComposer: () => void
	setFollow: (handle: string, on: boolean) => void
	stubEffects: () => void
	charState: (length: number) => string
	parseHHMM: (value: string | null) => number | null
	hhmm: (minutes: number) => string
	daySeed: (hour: number) => { dark: boolean; name: string }
	dayTokens: (hour: number) => { vars: Record<string, string> }
}

// The prototype is a single inline script. Execute its real declarations without
// registering document handlers or rendering a page, so these remain unit tests.
function loadMockup(): Mockup {
	const html = readFileSync(mockupFile, 'utf8')
	const start = html.indexOf('<script>') + '<script>'.length
	const end = html.indexOf('</script>', start)
	const script = html.slice(start, end)
	const wiring = script.indexOf('document.addEventListener("click", e => {')
	if (start < '<script>'.length || end < 0 || wiring < 0) {
		throw new Error('Mockup inline script or event wiring was not found')
	}
	const location = { search: '', hash: '#/home' }
	const code = `${script.slice(0, wiring)}
		({ location, state: S, posts: POSTS, handleStatus, parseRoute, richText, feedPosts,
		  renderPost, renderPoll, canReply, newDraft,
		  setComposer: (drafts, mode = 'new', target = null) => {
		    C = { mode, target, replyCtl: 'everyone', drafts, focus: 0 };
		  },
		  stubEffects: () => {
		    closeLayer = () => {}; rerender = () => {}; render = () => {}; toast = () => {};
		  },
		  composerValid, submitComposer, setFollow, charState, parseHHMM, hhmm, daySeed, dayTokens })`
	const context = {
		location,
		localStorage: { getItem: () => null },
		document: { getElementById: () => ({ innerHTML: '' }) },
	}
	Object.defineProperty(context, URLSearchParams.name, { value: URLSearchParams })
	return runInNewContext(code, context) as Mockup
}

describe('HTML mockup logic', () => {
	it.each([
		['', 'idle'],
		['ab', 'err'],
		['abc', 'ok'],
		['a'.repeat(20), 'ok'],
		['a'.repeat(21), 'err'],
		['bad-name', 'err'],
		['Admin', 'err'],
		['JIYUU', 'err'],
		['Sora', 'err'],
		['mikatanaka', 'ok'],
	])('validates username %j as %s', (value, status) => {
		expect(loadMockup().handleStatus(value)[0]).toBe(status)
	})

	it('parses hash routes, encoded paths, and query parameters', () => {
		const mockup = loadMockup()
		mockup.location.hash = '#/profile/leo%2Em?tab=media'
		const route = mockup.parseRoute()
		expect(route.name).toBe('profile')
		expect([...route.args]).toEqual(['leo.m'])
		expect(route.q.get('tab')).toBe('media')
		mockup.location.hash = '#/'
		expect(mockup.parseRoute().name).toBe('auth')
	})

	it('escapes user text while linking tags, handles, and URLs', () => {
		const html = loadMockup().richText(
			'<img onerror="x"> #SvelteKit @Leo.M https://site.test/?a=1&b=2',
		)
		expect(html).toContain('&lt;img onerror=&quot;x&quot;&gt;')
		expect(html).toContain('href="#/tag/sveltekit"')
		expect(html).toContain('href="#/profile/Leo.M"')
		expect(html).toContain('href="https://site.test/?a=1&amp;b=2"')
		expect(html).not.toContain('<img')
	})

	it('keeps replies and later thread posts out of the top-level feed', () => {
		const mockup = loadMockup()
		const ids = mockup.feedPosts('foryou').map((post) => post.id)
		expect(ids).toContain('p2')
		expect(ids).toContain('p5')
		expect(ids).not.toContain('r1')
		expect(ids).not.toContain('p5b')
		expect(ids).not.toContain('m1')
	})

	it('limits Following to followed accounts, own posts, and their reposts', () => {
		const mockup = loadMockup()
		const ids = mockup.feedPosts('following').map((post) => post.id)
		expect(ids).toContain('p1')
		expect(ids).toContain('m1')
		expect(ids).not.toContain('p2')
		mockup.posts.find((post) => post.id === 'p2')!.repostedBy = 'sora'
		expect(mockup.feedPosts('following').map((post) => post.id)).toContain('p2')
	})

	it('hides blocked authors and lets a muted post be revealed', () => {
		const mockup = loadMockup()
		const blocked = mockup.posts.find((post) => post.id === 'p12')!
		const muted = mockup.posts.find((post) => post.id === 'p7')!
		expect(mockup.renderPost(blocked)).toBe('')
		expect(mockup.renderPost(muted)).toContain('Post hidden: contains muted word')
		mockup.state.revealed.add('p7')
		expect(mockup.renderPost(muted)).toContain('Season finale')
	})

	it('enforces reply settings for the author, followers, and mentions', () => {
		const mockup = loadMockup()
		expect(mockup.canReply({ by: 'danokafor', text: '', replyCtl: 'everyone' })).toBe(true)
		expect(mockup.canReply({ by: 'mikatanaka', text: '', replyCtl: 'mentioned' })).toBe(true)
		expect(mockup.canReply({ by: 'danokafor', text: '', replyCtl: 'following' })).toBe(false)
		expect(mockup.canReply({ by: 'sora', text: '', replyCtl: 'following' })).toBe(true)
		expect(
			mockup.canReply({ by: 'danokafor', text: 'Hi @mikatanaka', replyCtl: 'mentioned' }),
		).toBe(true)
		expect(mockup.canReply({ by: 'danokafor', text: 'Hi everyone', replyCtl: 'mentioned' })).toBe(
			false,
		)
	})

	it('accepts exactly 280 characters and rejects longer or empty posts', () => {
		const mockup = loadMockup()
		const draft = mockup.newDraft('a'.repeat(280))
		mockup.setComposer([draft])
		expect(mockup.composerValid()).toBe(true)
		expect(mockup.charState(280)).toBe('warn')
		draft.text += 'b'
		expect(mockup.composerValid()).toBe(false)
		expect(mockup.charState(281)).toBe('over')
		draft.text = '  \n  '
		expect(mockup.composerValid()).toBe(false)
	})

	it('accepts media-only posts but requires two filled poll choices', () => {
		const mockup = loadMockup()
		const draft = mockup.newDraft()
		mockup.setComposer([draft])
		expect(mockup.composerValid()).toBe(false)
		draft.images.push('upload1')
		expect(mockup.composerValid()).toBe(true)
		draft.images = []
		draft.poll = { opts: ['Tabs', '   '] }
		expect(mockup.composerValid()).toBe(false)
		draft.poll.opts[1] = 'Spaces'
		expect(mockup.composerValid()).toBe(true)
	})

	it('requires every post in a thread to be valid', () => {
		const mockup = loadMockup()
		const first = mockup.newDraft('First')
		const second = mockup.newDraft()
		mockup.setComposer([first, second])
		expect(mockup.composerValid()).toBe(false)
		second.text = 'Second'
		expect(mockup.composerValid()).toBe(true)
	})

	it('submits a post with only valid poll choices', () => {
		const mockup = loadMockup()
		mockup.stubEffects()
		const draft = mockup.newDraft('Which one?')
		draft.poll = { opts: ['Tabs', '   ', 'Spaces'] }
		mockup.setComposer([draft])
		mockup.submitComposer()
		const created = mockup.posts.find((post) => post.id === 'n1')!
		expect(created.by).toBe('mikatanaka')
		expect(created.text).toBe('Which one?')
		expect(created.poll?.opts).toEqual([
			['Tabs', 0],
			['Spaces', 0],
		])
	})

	it('links a reply thread and increments the parent reply count once', () => {
		const mockup = loadMockup()
		mockup.stubEffects()
		const parent = mockup.posts.find((post) => post.id === 'p1')!
		const initialReplies = parent.c.r
		mockup.setComposer([mockup.newDraft('First'), mockup.newDraft('Second')], 'reply', 'p1')
		mockup.submitComposer()
		const first = mockup.posts.find((post) => post.id === 'n1')!
		const second = mockup.posts.find((post) => post.id === 'n2')!
		expect(first.replyTo).toBe('p1')
		expect(second.replyTo).toBe('n1')
		expect(first.thread).toBe(second.thread)
		expect(parent.c.r).toBe(initialReplies + 1)
	})

	it('does not submit invalid text and marks a valid edit', () => {
		const mockup = loadMockup()
		mockup.stubEffects()
		const originalCount = mockup.posts.length
		mockup.setComposer([mockup.newDraft('   ')])
		mockup.submitComposer()
		expect(mockup.posts).toHaveLength(originalCount)
		mockup.setComposer([mockup.newDraft('Updated')], 'edit', 'm2')
		mockup.submitComposer()
		const edited = mockup.posts.find((post) => post.id === 'm2')!
		expect(edited.text).toBe('Updated')
		expect(edited.edited).toBe(true)
		expect(mockup.posts).toHaveLength(originalCount)
	})

	it('requests a private follow and toggles a public follow', () => {
		const mockup = loadMockup()
		mockup.stubEffects()
		mockup.setFollow('aikosato', true)
		expect(mockup.state.requested.has('aikosato')).toBe(true)
		expect(mockup.state.following.has('aikosato')).toBe(false)
		mockup.setFollow('danokafor', true)
		expect(mockup.state.following.has('danokafor')).toBe(true)
		mockup.setFollow('danokafor', false)
		expect(mockup.state.following.has('danokafor')).toBe(false)
	})

	it('shows poll results after a vote and for ended polls', () => {
		const mockup = loadMockup()
		const active = mockup.posts.find((post) => post.id === 'p3')!
		const ended = mockup.posts.find((post) => post.id === 'p11')!
		expect(mockup.renderPoll(active)).toContain('data-act="vote"')
		mockup.state.votes.p3 = 1
		expect(mockup.renderPoll(active)).not.toContain('data-act="vote"')
		expect(mockup.renderPoll(active)).toContain('%')
		expect(mockup.renderPoll(ended)).toContain('Final results')
	})

	it('parses and formats clock boundaries for Daylight preview', () => {
		const mockup = loadMockup()
		expect(mockup.parseHHMM('00:00')).toBe(0)
		expect(mockup.parseHHMM('23:59')).toBe(1439)
		expect(mockup.parseHHMM('905')).toBe(545)
		for (const invalid of [null, '24:00', '12:60', '9:5', 'noon']) {
			expect(mockup.parseHHMM(invalid)).toBeNull()
		}
		expect(mockup.hhmm(545)).toBe('09:05')
	})

	it('keeps Daylight in a light or dark palette through dawn and dusk', () => {
		const mockup = loadMockup()
		expect(mockup.daySeed(5.9).dark).toBe(true)
		expect(mockup.daySeed(6.1).dark).toBe(false)
		expect(mockup.daySeed(18.1).dark).toBe(false)
		expect(mockup.daySeed(18.5).dark).toBe(true)
		expect(mockup.daySeed(12.5).name).toBe('Midday')
		expect(mockup.dayTokens(12.5).vars['--bg']).toBeTruthy()
	})
})

const tempDirs: string[] = []
afterEach(() => {
	for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

type ScreenshotEvent = {
	type: string
	url?: string
	path?: string
	options?: Record<string, unknown>
}

function runScreenshotCapture(filter?: string): ScreenshotEvent[] {
	const dir = mkdtempSync(join(tmpdir(), 'jiyuu-shots-test-'))
	tempDirs.push(dir)
	const moduleDir = join(dir, 'node_modules/playwright')
	mkdirSync(moduleDir, { recursive: true })
	writeFileSync(join(dir, 'package.json'), '{"private":true}')
	writeFileSync(
		join(moduleDir, 'index.js'),
		`const fs = require('node:fs');
		const events = [];
		module.exports.chromium = { launch: async () => ({
			newContext: async options => {
				events.push({ type: 'context', options });
				return {
					newPage: async () => ({
						goto: async url => events.push({ type: 'goto', url }),
						waitForLoadState: async () => {},
						waitForFunction: async () => {},
						waitForTimeout: async () => {},
						screenshot: async ({ path }) => events.push({ type: 'screenshot', path }),
					}),
					close: async () => events.push({ type: 'context-close' }),
				};
			},
			close: async () => fs.writeFileSync(process.env.JIYUU_SHOTS_LOG, JSON.stringify(events)),
		}) };
		`,
	)
	const log = join(dir, 'events.json')
	const run = spawnSync(process.execPath, [screenshotScript, ...(filter ? [filter] : [])], {
		cwd: repo,
		env: { ...process.env, JIYUU_SHOTS_DIR: dir, JIYUU_SHOTS_LOG: log },
		encoding: 'utf8',
		timeout: 10_000,
	})
	if (run.status !== 0) throw new Error(`Screenshot script failed: ${run.stderr || run.error}`)
	return JSON.parse(readFileSync(log, 'utf8')) as ScreenshotEvent[]
}

describe('mockup screenshot utility', () => {
	it('captures the seven routes for both devices and themes', () => {
		const events = runScreenshotCapture()
		const contexts = events.filter((event) => event.type === 'context')
		const visits = events.filter((event) => event.type === 'goto')
		const files = events.filter((event) => event.type === 'screenshot')
		expect(contexts).toHaveLength(4)
		expect(visits).toHaveLength(28)
		expect(files).toHaveLength(28)
		expect(contexts.map((event) => event.options?.colorScheme)).toEqual([
			'light',
			'dark',
			'light',
			'dark',
		])
		expect(contexts[0].options?.viewport).toEqual({ width: 1440, height: 900 })
		expect(contexts[2].options?.viewport).toEqual({ width: 390, height: 844 })
		expect(contexts[2].options?.hasTouch).toBe(true)
		expect(visits[0].url).toBe(`file://${mockupFile}?theme=light#/auth`)
		expect(visits[27].url).toBe(`file://${mockupFile}?theme=dark#/messages`)
		expect(files.map((event) => event.path)).toContain(
			join(repo, 'design/mockup/screenshots/profile-mobile-dark.png'),
		)
		expect(events.filter((event) => event.type === 'context-close')).toHaveLength(4)
	})

	it('captures only an exact page filter, including its routed detail page', () => {
		const events = runScreenshotCapture('post')
		expect(events.filter((event) => event.type === 'goto').map((event) => event.url)).toEqual([
			`file://${mockupFile}?theme=light#/post/p2`,
			`file://${mockupFile}?theme=dark#/post/p2`,
			`file://${mockupFile}?theme=light#/post/p2`,
			`file://${mockupFile}?theme=dark#/post/p2`,
		])
		expect(events.filter((event) => event.type === 'screenshot')).toHaveLength(4)
	})

	it('does not capture a different page for an unknown filter', () => {
		const events = runScreenshotCapture('posts')
		expect(events.filter((event) => event.type === 'screenshot')).toHaveLength(0)
	})
})
