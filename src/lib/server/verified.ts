import { eq, sql, type SQL } from 'drizzle-orm'
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core'
import type { getDb } from './db'
import { verifiedAccount } from './db/schema'

type Db = ReturnType<typeof getDb>

export const is_verified = (user_id: AnySQLiteColumn | SQL) =>
	sql<number>`exists(select 1 from verified_account v where v.user_id = ${user_id})`

export async function find_verified(db: Db, user_id: string) {
	const [row] = await db
		.select({ kind: verifiedAccount.kind })
		.from(verifiedAccount)
		.where(eq(verifiedAccount.userId, user_id))
		.limit(1)
	return !!row
}
