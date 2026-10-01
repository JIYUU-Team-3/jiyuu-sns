/**
 * Give the built Worker a `scheduled` handler for the hourly Cron Trigger in wrangler.jsonc. The
 * Cloudflare adapter writes only `fetch` to `main` and has no hook for more, so after `vite build`
 * this moves its worker beside the server bundle, out of the public assets folder, and writes an
 * entry in its place that adds the cron. Run by `pnpm build`; running it twice changes nothing.
 *
 * The scheduled run calls the app's `/internal/hourly` route in-process, with a token made fresh
 * for the run, so the job runs the app's own code and no request from outside can start it.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const ENTRY = '.svelte-kit/cloudflare/_worker.js'
const APP = '.svelte-kit/cloudflare-tmp/app.js'
const MARKER = '// Wrapped by scripts/wrap-worker.ts'

const built = readFileSync(ENTRY, 'utf8')
if (built.startsWith(MARKER)) process.exit(0)

// The adapter's worker imports the server bundle relative to itself; it now sits beside it.
const imports = built.match(/'\.\/\.\.\/cloudflare-tmp\//g) ?? []
if (imports.length !== 1)
	throw new Error(`Unexpected adapter output: ${imports.length} server imports`)
writeFileSync(APP, built.replace("'./../cloudflare-tmp/", "'./"))

writeFileSync(
	ENTRY,
	`${MARKER}
import app from './../cloudflare-tmp/app.js'

const CRON_TOKEN = Symbol.for('jiyuu.cron-token')

export default {
	fetch: app.fetch,

	async scheduled(_controller, env, ctx) {
		const token = crypto.randomUUID()
		globalThis[CRON_TOKEN] = token
		// The app's own origin, in the URL and the Origin header: SvelteKit refuses a POST from
		// anywhere else, and its worker remembers the first origin it sees.
		const origin = env.ORIGIN || 'https://jiyuu.internal'
		try {
			const response = await app.fetch(
				new Request(new URL('/internal/hourly', origin), {
					method: 'POST',
					headers: { 'x-cron-token': token, origin },
				}),
				env,
				ctx,
			)
			const summary = await response.text()
			if (!response.ok) throw new Error('Hourly job failed (' + response.status + '): ' + summary)
			console.log('Hourly job', summary)
		} finally {
			delete globalThis[CRON_TOKEN]
		}
	},
}
`,
)
