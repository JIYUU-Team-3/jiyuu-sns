/**
 * Make the account that holds a handle a moderator, or stop it being one. The role is stored
 * against the account's id, so it stays with that account if the handle ever changes, and the
 * app never grants it on its own. See docs/MODERATION.md.
 *
 *   pnpm db:grant-moderator jiyuu_org --local            the local D1
 *   pnpm db:grant-moderator jiyuu_org --remote           production
 *   pnpm db:revoke-moderator jiyuu_org --remote          take the role away
 */
import { literal, run } from './d1.ts'

const handle = process.argv.slice(2).find((arg) => !arg.startsWith('--'))
if (!handle || !/^[a-z0-9_.]{3,20}$/.test(handle)) {
	console.error('Give the handle, without the @: pnpm db:grant-moderator jiyuu_org --local')
	process.exit(1)
}
const role = process.argv.includes('--revoke') ? 'member' : 'moderator'

const [account] = await run(`select user_id from profile where handle = ${literal(handle)}`)
if (!account) {
	console.error(
		`No account has the handle @${handle}. Sign in with it and finish the profile first.`,
	)
	process.exit(1)
}
const user_id = String(account.user_id)

await run(
	`insert into account_standing (user_id, role) values (${literal(user_id)}, ${literal(role)})
	on conflict (user_id) do update set role = excluded.role,
	updated_at = cast(unixepoch('subsecond') * 1000 as integer)`,
)
console.log(
	role === 'moderator' ? `@${handle} is now a moderator.` : `@${handle} is no longer a moderator.`,
)
