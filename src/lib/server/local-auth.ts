import { eq } from 'drizzle-orm'
import type { getDb } from './db'
import { profile, user } from './db/schema'

/** Explicitly opted-in Vite development only, with a loopback request origin. */
export function allow_local_auth(dev: boolean, enabled: boolean, url: URL) {
	return (
		dev &&
		enabled &&
		url.protocol === 'http:' &&
		['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
	)
}

/** A real local account keeps normal profile, ownership and DM membership checks working. */
export async function local_developer(db: ReturnType<typeof getDb>) {
	const id = 'local-dev-user'
	await db.batch([
		db
			.insert(user)
			.values({ id, name: 'Local developer', email: 'local-dev@example.test' })
			.onConflictDoNothing(),
		db
			.insert(profile)
			.values({ userId: id, handle: 'local_dev', displayName: 'Local developer' })
			.onConflictDoNothing(),
	])
	const [account] = await db.select().from(user).where(eq(user.id, id)).limit(1)
	if (!account) throw new Error('Could not create the local developer account.')
	return account
}
