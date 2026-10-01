import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

/** Where `wrangler dev --local` keeps D1, as `pnpm db:migrate:local` and the e2e server use it. */
const D1_DIR = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject'

/**
 * Make `handle` a moderator in the local D1 the e2e server reads: the same row
 * `pnpm db:grant-moderator <handle> --local` writes. There is no way to do it through the app, on
 * purpose. The script starts a second wrangler, whose write can collide with the server's own
 * writes while other tests run; one statement straight to the file, waiting its turn, can't.
 */
export function grant_moderator(handle: string) {
	const file = readdirSync(D1_DIR).find(
		(name) => name.endsWith('.sqlite') && name !== 'metadata.sqlite',
	)
	if (!file) throw new Error(`No local D1 in ${D1_DIR}; run pnpm db:migrate:local first.`)
	const db = new DatabaseSync(join(D1_DIR, file))
	try {
		db.exec('pragma busy_timeout = 5000')
		const granted = db
			.prepare(
				`insert into account_standing (user_id, role)
				select user_id, 'moderator' from profile where handle = ?
				on conflict (user_id) do update set role = 'moderator'`,
			)
			.run(handle)
		if (granted.changes !== 1) throw new Error(`No local account has the handle @${handle}.`)
	} finally {
		db.close()
	}
}
