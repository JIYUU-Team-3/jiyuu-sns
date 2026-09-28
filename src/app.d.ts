import type { User, Session } from 'better-auth'
import { createAuth } from '#lib/server/auth'
import type { getDb } from '#lib/server/db'

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Platform {
			env: Env
			ctx: ExecutionContext
			caches: CacheStorage
			cf?: IncomingRequestCfProperties
		}

		interface Locals {
			user?: User
			session?: Session
			auth: ReturnType<typeof createAuth>
			db: ReturnType<typeof getDb>
		}

		// interface Error {}
		// interface PageData {}
		// interface PageState {}
	}
}

export {}
