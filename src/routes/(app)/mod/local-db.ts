import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

/**
 * Changes e2e tests make straight in the local D1 the e2e server reads, for state the app never
 * lets anyone set: moderator rights, and an account's age.
 */

/** Where `wrangler dev --local` keeps D1, as `pnpm db:migrate:local` and the e2e server use it. */
const D1_DIR = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject'

/**
 * A write straight to the file, waiting its turn. `pnpm db:grant-moderator --local` starts a
 * second wrangler instead, whose write can collide with the server's own while other tests run.
 * The server doesn't wait for a lock (it gets SQLITE_BUSY), so the lock is held for as little as
 * possible: the rare collision left is a logged error a retry absorbs, not a wrong result.
 */
function write(run: (db: DatabaseSync) => void) {
	const file = readdirSync(D1_DIR).find(
		(name) => name.endsWith('.sqlite') && name !== 'metadata.sqlite',
	)
	if (!file) throw new Error(`No local D1 in ${D1_DIR}; run pnpm db:migrate:local first.`)
	const db = new DatabaseSync(join(D1_DIR, file))
	try {
		db.exec('pragma busy_timeout = 5000')
		// Leave checkpointing the log to the server: a checkpoint here would hold the lock longer.
		db.exec('pragma wal_autocheckpoint = 0')
		// One short transaction, so the server's own writes meet the lock once at most.
		db.exec('begin immediate')
		try {
			run(db)
			db.exec('commit')
		} catch (error) {
			db.exec('rollback')
			throw error
		}
	} finally {
		db.close()
	}
}

/** Make `handle` a moderator: the row `pnpm db:grant-moderator <handle> --local` writes. */
export function grant_moderator(handle: string) {
	write((db) => {
		const granted = db
			.prepare(
				`insert into account_standing (user_id, role)
				select user_id, 'moderator' from profile where handle = ?
				on conflict (user_id) do update set role = 'moderator'`,
			)
			.run(handle)
		if (granted.changes !== 1) throw new Error(`No local account has the handle @${handle}.`)
	})
}

/**
 * Age `handle` past the new-account limits: signed up `days` ago, with three earlier posts. The
 * posts are replies to nothing, which no feed shows (only the profile's Replies tab), so they stay
 * out of the way of what tests look for.
 */
export function settle_account(handle: string, days = 10) {
	write((db) => {
		const [row] = db.prepare('select user_id from profile where handle = ?').all(handle) as {
			user_id: string
		}[]
		if (!row) throw new Error(`No local account has the handle @${handle}.`)
		const then = Date.now() - days * 24 * 60 * 60 * 1000
		db.prepare('update user set created_at = ? where id = ?').run(then, row.user_id)
		for (let i = 0; i < 3; i++) {
			db.prepare(
				`insert into post (id, author_id, body, is_reply, created_at) values (?, ?, ?, 1, ?)`,
			).run(crypto.randomUUID(), row.user_id, `Earlier post ${i}`, then)
		}
	})
}

/** Move a removed post's removal `days` into the past, as if its day to appeal had passed. */
export function age_removal(post_id: string, days = 2) {
	write((db) => {
		const aged = db
			.prepare(
				'update post set removed_at = removed_at - ? where id = ? and removed_at is not null',
			)
			.run(days * 24 * 60 * 60 * 1000, post_id)
		if (aged.changes !== 1) throw new Error(`No removed post ${post_id}.`)
	})
}
