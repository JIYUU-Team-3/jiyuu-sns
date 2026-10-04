/**
 *   pnpm db:grant-verified por_chheng --local
 *   pnpm db:grant-verified por_chheng --remote
 *   pnpm db:revoke-verified por_chheng --remote
 */
import { literal, run } from './d1.ts'

const handle = process.argv.slice(2).find((arg) => !arg.startsWith('--'))
if (!handle || !/^[a-z0-9_.]{3,20}$/.test(handle)) {
	console.error('Give the handle, without the @: pnpm db:grant-verified por_chheng --local')
	process.exit(1)
}
const revoke = process.argv.includes('--revoke')

const [account] = await run(`select user_id from profile where handle = ${literal(handle)}`)
if (!account) {
	console.error(
		`No account has the handle @${handle}. Sign in with it and finish the profile first.`,
	)
	process.exit(1)
}
const user_id = literal(String(account.user_id))

await run(
	revoke
		? `delete from verified_account where user_id = ${user_id}`
		: `insert into verified_account (user_id, kind) values (${user_id}, 'developer')
		on conflict (user_id) do update set kind = excluded.kind`,
)
console.log(revoke ? `@${handle} is no longer verified.` : `@${handle} is now verified.`)
