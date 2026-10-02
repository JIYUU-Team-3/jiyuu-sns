import { readFileSync, writeFileSync } from 'node:fs'

const ENTRY = '.svelte-kit/cloudflare/_worker.js'
const APP = '.svelte-kit/cloudflare-tmp/app.js'
const MARKER = '// Wrapped by scripts/wrap-worker.js'

const built = readFileSync(ENTRY, 'utf8')
if (built.startsWith(MARKER)) process.exit(0)

const imports = built.match(/'\.\/\.\.\/cloudflare-tmp\//g) ?? []
if (imports.length !== 1)
	throw new Error(`Unexpected adapter output: ${imports.length} server imports`)
writeFileSync(APP, built.replace("'./../cloudflare-tmp/", "'./"))

writeFileSync(
	ENTRY,
	`${MARKER}
import app from './../cloudflare-tmp/app.js'
import { LIVE_PREFIX, open_live } from './../../src/lib/server/live.ts'

export { ChatRoom } from './../../src/lib/server/chat-room.ts'

export default {
	fetch(request, env, ctx) {
		if (new URL(request.url).pathname.startsWith(LIVE_PREFIX)) return open_live(request, env)
		return app.fetch(request, env, ctx)
	},
}
`,
)
