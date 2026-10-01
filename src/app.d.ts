import type { User, Session } from 'better-auth'
import { createAuth } from '#lib/server/auth'
import type { getDb } from '#lib/server/db'
import type { Prefs } from '#lib/settings/prefs'

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
			/** The device's display preferences, from its cookie. */
			prefs: Prefs
		}

		// interface Error {}
		interface PageData {
			/** From the root layout, for every page. */
			prefs?: Prefs
		}
		// interface PageState {}
	}
}

export {}
