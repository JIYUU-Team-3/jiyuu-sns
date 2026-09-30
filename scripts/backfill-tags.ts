/**
 * Save the hashtags of posts written before tags were stored, so tag search and trending find
 * them too. Safe to run any number of times: it reads every post with a `#` and inserts only
 * the tags that aren't saved yet, so a run that stopped partway through a post is finished by
 * the next one.
 *
 *   pnpm db:backfill-tags --local    the local D1 that `pnpm dev` uses
 *   pnpm db:backfill-tags --remote   production, over the D1 HTTP API, with the same
 *                                    CLOUDFLARE_* variables as `drizzle-kit migrate`
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { extract_tags } from '../src/lib/posts/text.ts'

const remote = process.argv.includes('--remote')
if (!remote && !process.argv.includes('--local')) {
	console.error('Say which database: --local or --remote')
	process.exit(1)
}

type Row = Record<string, unknown>

/** wrangler's own CLI, run with this Node and no shell in between. */
const wrangler = join(
	dirname(createRequire(import.meta.url).resolve('wrangler/package.json')),
	'bin/wrangler.js',
)

/** Run one statement and return its rows. */
async function run(sql: string): Promise<Row[]> {
	if (remote) {
		const { CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_DATABASE_ID, CLOUDFLARE_D1_TOKEN } = process.env
		if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_DATABASE_ID || !CLOUDFLARE_D1_TOKEN) {
			throw new Error(
				'CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_DATABASE_ID and CLOUDFLARE_D1_TOKEN must be set',
			)
		}
		const response = await fetch(
			`https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${CLOUDFLARE_DATABASE_ID}/query`,
			{
				method: 'POST',
				headers: {
					authorization: `Bearer ${CLOUDFLARE_D1_TOKEN}`,
					'content-type': 'application/json',
				},
				body: JSON.stringify({ sql }),
			},
		)
		const body = (await response.json()) as {
			success: boolean
			errors?: unknown
			result?: { results: Row[] }[]
		}
		if (!response.ok || !body.success)
			throw new Error(`D1 query failed: ${JSON.stringify(body.errors)}`)
		return body.result?.[0]?.results ?? []
	}
	// wrangler reads the statement from a file, which avoids quoting SQL for the shell.
	const dir = mkdtempSync(join(tmpdir(), 'backfill-'))
	try {
		const file = join(dir, 'query.sql')
		writeFileSync(file, sql)
		const out = execFileSync(
			process.execPath,
			[wrangler, 'd1', 'execute', 'DB', '--local', '--json', '--file', file],
			{ encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
		)
		return (JSON.parse(out) as { results: Row[] }[])[0]?.results ?? []
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
}

/** SQL string literal. Ids are UUIDs and tags letters and digits, but quote properly anyway. */
const literal = (text: string) => `'${text.replace(/'/g, "''")}'`

let after = ''
let posts = 0
let tags = 0
for (;;) {
	// Keyset paging by id, so posts whose `#` isn't a real tag are passed over, not re-read.
	const rows = await run(
		`select id, body, created_at from post
		where body like '%#%' and id > ${literal(after)}
		order by id limit 500`,
	)
	if (!rows.length) break
	after = String(rows.at(-1)!.id)

	const values: string[] = []
	for (const row of rows) {
		posts += 1
		for (const tag of extract_tags(String(row.body))) {
			values.push(`(${literal(String(row.id))}, ${literal(tag)}, ${Number(row.created_at)})`)
			tags += 1
		}
	}
	for (let i = 0; i < values.length; i += 100) {
		await run(
			`insert or ignore into post_tag (post_id, tag, created_at) values ${values.slice(i, i + 100).join(', ')}`,
		)
	}
}
// Only the two counts are printed. They're counted up one at a time here, not taken from
// anything the database returned, so no text from the database can reach the log.
console.log(
	'Checked %d posts with a # and %d tags; tags already saved were left as they were.',
	posts,
	tags,
)
