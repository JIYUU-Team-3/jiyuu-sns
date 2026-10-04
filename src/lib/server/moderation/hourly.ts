import {
	and,
	desc,
	eq,
	gt,
	inArray,
	isNotNull,
	isNull,
	like,
	lt,
	notInArray,
	or,
} from 'drizzle-orm'
import type { getDb } from '../db'
import { chunks } from '../db/chunks'
import { linkPreview, mediaCheck, post } from '../db/schema'
import { ensure_preview, RETRY_AFTER } from '../link-preview'
import { delete_media, media_url } from '../media'
import { unused_uploads } from '../posts'
import { raise_case } from './cases'
import { check_post, type CheckDeps } from './checks'
import { block_domain, blocked_hosts, links_in, reputation } from './links'
import { purge_removed_posts } from './posts'
import { run_scores } from './score'

type Db = ReturnType<typeof getDb>

const HOUR = 60 * 60 * 1000

/** Each run's ceilings, so one run's cost is known whatever piled up. */
export const HOURLY = {
	/** Posts the checks couldn't finish, retried from the last two days. */
	retries: 20,
	retry_window: 48 * HOUR,
	/** A `pending` post younger than this may still be checked by the request that posted it. */
	pending_grace: 10 * 60 * 1000,
	/** Recent posts read for links, and distinct hosts looked up. */
	link_posts: 300,
	link_hosts: 50,
	link_window: 7 * 24 * HOUR,
	/** How long an upload's check is kept; many are for photos that never made it into a post. */
	upload_check_window: 30 * 24 * HOUR,
	/** Post uploads looked at for ones no post uses, and how old one must be: a draft can sit open. */
	sweep_objects: 500,
	sweep_grace: 24 * HOUR,
	/** Links of recent posts whose card is missing, read again; each is a page and a picture. */
	link_cards: 20,
} as const

export type HourlyDeps = CheckDeps & {
	lookup?: typeof fetch
	/** Remembers where the upload sweep stopped; without it every run starts from the first file. */
	kv?: KVNamespace
}

const SWEEP_CURSOR = 'sweep:post-uploads'

/**
 * Delete post uploads that no post uses a day after they were made: the composer deletes what a
 * draft throws away, but not when the tab is closed or the request fails. One page of the bucket a
 * run, carrying on where the last run stopped, so a run's cost doesn't grow with the bucket.
 */
async function sweep_uploads(db: Db, deps: HourlyDeps, now: number) {
	const cursor = (await deps.kv?.get(SWEEP_CURSOR)) ?? undefined
	const options = { prefix: 'posts/', limit: HOURLY.sweep_objects }
	// A cursor R2 no longer takes starts the sweep over rather than stopping it for good.
	const page = await deps.bucket.list({ ...options, cursor }).catch(() => deps.bucket.list(options))
	const old = page.objects
		.filter((object) => object.uploaded.getTime() < now - HOURLY.sweep_grace)
		.map((object) => media_url(object.key))
	const unused: string[] = []
	for (const part of chunks(old)) unused.push(...(await unused_uploads(db, part)))
	await delete_media(deps.bucket, unused)
	for (const part of chunks(unused)) {
		await db.delete(mediaCheck).where(inArray(mediaCheck.url, part))
	}
	if (page.truncated) await deps.kv?.put(SWEEP_CURSOR, page.cursor)
	else await deps.kv?.delete(SWEEP_CURSOR)
	return unused.length
}

/**
 * The hourly job, run by the Worker's Cron Trigger: deletes removed posts whose day has passed,
 * retries checks that couldn't run, asks again about hosts in recent posts, since a domain can turn
 * bad after it was posted, scores the accounts active lately, and deletes uploads no post ever
 * used. Returns what it did, for the log.
 */
export async function run_hourly(db: Db, deps: HourlyDeps, now = Date.now()) {
	const { purged, unused } = await purge_removed_posts(db, now)
	await delete_media(deps.bucket, unused)
	await db
		.delete(mediaCheck)
		.where(lt(mediaCheck.createdAt, new Date(now - HOURLY.upload_check_window)))

	const pending = await db
		.select({ id: post.id })
		.from(post)
		.where(
			and(
				// `pending` ones too, once they're older than any check still running after the response.
				or(
					eq(post.checked, 'unchecked'),
					and(
						eq(post.checked, 'pending'),
						lt(post.createdAt, new Date(now - HOURLY.pending_grace)),
					),
				),
				gt(post.createdAt, new Date(now - HOURLY.retry_window)),
			),
		)
		.limit(HOURLY.retries)
	for (const row of pending) await check_post(db, deps, row.id)

	const recent = await db
		.select({ id: post.id, author_id: post.authorId, body: post.body })
		.from(post)
		.where(
			and(
				like(post.body, '%http%'),
				gt(post.createdAt, new Date(now - HOURLY.link_window)),
				notInArray(post.moderation, ['removed']),
			),
		)
		// Newest first: a domain is likeliest to have turned bad since it was posted recently.
		.orderBy(desc(post.createdAt))
		.limit(HOURLY.link_posts)
	const posts_by_host = new Map<string, typeof recent>()
	for (const row of recent) {
		for (const link of links_in(row.body)) {
			posts_by_host.set(link.host, [...(posts_by_host.get(link.host) ?? []), row])
		}
	}
	const already = await blocked_hosts(db, [...posts_by_host.keys()])
	const hosts = [...posts_by_host.keys()]
		.filter((host) => !already.has(host))
		.slice(0, HOURLY.link_hosts)
	let blocked = 0
	for (const host of hosts) {
		if ((await reputation(host, deps.lookup)) !== 'blocked') continue
		blocked += 1
		await block_domain(db, host, null, 'malicious_link')
		for (const row of posts_by_host.get(host) ?? []) {
			await raise_case(
				db,
				{ kind: 'post', id: row.id, user_id: row.author_id },
				{ reason: 'malicious_link', weight: 5, flags: { links: [host] } },
			)
		}
	}
	const cards = await retry_link_cards(db, deps, now)
	const scores = await run_scores(db, now)
	const swept = await sweep_uploads(db, deps, now)
	return { purged, retried: pending.length, hosts: hosts.length, blocked, cards, swept, ...scores }
}

/**
 * Read again the links of the last week's posts that have no card: the page failed or was slow
 * when the post was made, or reading it never finished. Only links whose last try is older than
 * `RETRY_AFTER`, so the job and the composer don't ask a site over and over.
 */
async function retry_link_cards(db: Db, deps: HourlyDeps, now: number) {
	const links = await db
		.selectDistinct({ url: post.linkUrl })
		.from(post)
		.leftJoin(linkPreview, eq(linkPreview.url, post.linkUrl))
		.where(
			and(
				isNotNull(post.linkUrl),
				gt(post.createdAt, new Date(now - HOURLY.link_window)),
				notInArray(post.moderation, ['removed']),
				or(
					isNull(linkPreview.url),
					and(isNull(linkPreview.title), lt(linkPreview.fetchedAt, new Date(now - RETRY_AFTER))),
				),
			),
		)
		.limit(HOURLY.link_cards)
	let found = 0
	for (const { url } of links) {
		if (!url) continue
		const card = await ensure_preview(db, { bucket: deps.bucket, fetcher: deps.fetcher }, url)
		if (card) found += 1
	}
	return found
}

/**
 * The one-time token the Worker's `scheduled` handler (scripts/wrap-worker.js) puts here before
 * calling the hourly route in-process. A request from outside can't know it.
 */
export const CRON_TOKEN = Symbol.for('jiyuu.cron-token')
