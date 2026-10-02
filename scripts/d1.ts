/**
 * Run SQL against the local D1 (`--local`, what `pnpm dev` and the e2e server use) or production
 * (`--remote`, over the D1 HTTP API with the same CLOUDFLARE_* variables as `drizzle-kit
 * migrate`), for the maintenance scripts in this folder.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

/** Which database the script was told to use. It never guesses: production is `--remote`. */
export const remote = process.argv.includes('--remote')
if (!remote && !process.argv.includes('--local')) {
	console.error('Say which database: --local or --remote')
	process.exit(1)
}

export type Row = Record<string, unknown>

/** wrangler's own CLI, run with this Node and no shell in between. */
const wrangler = join(
	dirname(createRequire(import.meta.url).resolve('wrangler/package.json')),
	'bin/wrangler.js',
)

/** Run one statement and return its rows. */
export async function run(sql: string): Promise<Row[]> {
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

/** SQL string literal. Values here are ids, handles and tags, but quote properly anyway. */
export const literal = (text: string) => `'${text.replace(/'/g, "''")}'`
