import { drizzle } from 'drizzle-orm/d1'
import * as schema from './schema'

const clients = new WeakMap<D1Database, ReturnType<typeof make>>()
const make = (d1: D1Database) => drizzle(d1, { schema })

/**
 * One client per binding: building one walks the whole schema's relations, CPU every request
 * would otherwise spend before reading a row.
 */
export function getDb(d1: D1Database) {
	if (!d1) return make(d1)
	let db = clients.get(d1)
	if (!db) clients.set(d1, (db = make(d1)))
	return db
}
