import { and, eq, gt, like, notInArray } from 'drizzle-orm'
import type { getDb } from '../db'
import { post } from '../db/schema'
import { delete_media } from '../media'
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
	/** Recent posts read for links, and distinct hosts looked up. */
	link_posts: 300,
	link_hosts: 50,
	link_window: 7 * 24 * HOUR,
} as const

export type HourlyDeps = CheckDeps & { lookup?: typeof fetch }

/**
 * The hourly job, run by the Worker's Cron Trigger: deletes removed posts whose day has passed,
 * retries checks that couldn't run, asks again about hosts in recent posts, since a domain can turn
 * bad after it was posted, and scores the accounts active lately. Returns what it did, for the log.
 */
export async function run_hourly(db: Db, deps: HourlyDeps, now = Date.now()) {
	const { purged, unused } = await purge_removed_posts(db, now)
	await delete_media(deps.bucket, unused)

	const pending = await db
		.select({ id: post.id })
		.from(post)
		.where(
			and(eq(post.checked, 'unchecked'), gt(post.createdAt, new Date(now - HOURLY.retry_window))),
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
	const scores = await run_scores(db, now)
	return { purged, retried: pending.length, hosts: hosts.length, blocked, ...scores }
}

/**
 * The one-time token the Worker's `scheduled` handler (scripts/wrap-worker.js) puts here before
 * calling the hourly route in-process. A request from outside can't know it.
 */
export const CRON_TOKEN = Symbol.for('jiyuu.cron-token')
