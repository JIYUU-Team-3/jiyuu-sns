/**
 * An in-memory D1 for unit tests: Node's own SQLite behind the few D1 methods Drizzle calls, with
 * every migration in `drizzle/` applied. Queries run through the same Drizzle D1 driver as in
 * production, so a test exercises the real SQL. Only for `*.spec.ts`; never imported by the app.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { getDb } from './index'
import { user } from './schema'
import { profile } from './schema'

const MIGRATIONS = join(import.meta.dirname, '../../../../drizzle')

/** D1 takes booleans and undefined; SQLite wants numbers and null. */
const to_sqlite = (value: unknown): SQLInputValue =>
	typeof value === 'boolean' ? Number(value) : value === undefined ? null : (value as SQLInputValue)

class Statement {
	constructor(
		readonly sqlite: DatabaseSync,
		readonly sql: string,
		readonly params: unknown[] = [],
	) {}

	bind(...params: unknown[]) {
		return new Statement(this.sqlite, this.sql, params)
	}

	/** Rows as objects, the way D1 hands them back from `all()` and from a batch. */
	results() {
		return this.sqlite.prepare(this.sql).all(...this.params.map(to_sqlite))
	}

	async all() {
		return { success: true, results: this.results(), meta: {} }
	}

	async raw() {
		const statement = this.sqlite.prepare(this.sql)
		statement.setReturnArrays(true)
		return statement.all(...this.params.map(to_sqlite))
	}

	async run() {
		const { changes } = this.sqlite.prepare(this.sql).run(...this.params.map(to_sqlite))
		return { success: true, results: [], meta: { changes } }
	}

	async first() {
		return this.results()[0] ?? null
	}
}

/** A fresh database with the schema, and the Drizzle client the app would use on it. */
export function test_db() {
	const sqlite = new DatabaseSync(':memory:')
	sqlite.exec('pragma foreign_keys = on')
	for (const file of readdirSync(MIGRATIONS)
		.filter((name) => name.endsWith('.sql'))
		.sort()) {
		for (const statement of readFileSync(join(MIGRATIONS, file), 'utf8').split(
			'--> statement-breakpoint',
		)) {
			if (statement.trim()) sqlite.exec(statement)
		}
	}
	const d1 = {
		prepare: (sql: string) => new Statement(sqlite, sql),
		// D1 runs a batch as one transaction.
		async batch(statements: Statement[]) {
			sqlite.exec('begin')
			try {
				const results = statements.map((statement) => ({
					success: true,
					results: statement.results(),
					meta: {},
				}))
				sqlite.exec('commit')
				return results
			} catch (error) {
				sqlite.exec('rollback')
				throw error
			}
		},
		exec: async (sql: string) => sqlite.exec(sql),
	}
	return getDb(d1 as unknown as D1Database)
}

export type TestDb = ReturnType<typeof test_db>

/** An account with a finished profile; its id is its handle, to keep tests readable. */
export async function add_account(db: TestDb, handle: string) {
	await db.insert(user).values({ id: handle, name: handle, email: `${handle}@example.test` })
	await db.insert(profile).values({ userId: handle, handle, displayName: handle })
	return handle
}
