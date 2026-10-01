/**
 * Save the hashtags of posts written before tags were stored, so tag search and trending find
 * them too. Safe to run any number of times: it reads every post with a `#` or `＃` and
 * inserts only the tags that aren't saved yet, so a run that stopped partway through a post is
 * finished by the next one.
 *
 *   pnpm db:backfill-tags --local    the local D1 that `pnpm dev` uses
 *   pnpm db:backfill-tags --remote   production, over the D1 HTTP API, with the same
 *                                    CLOUDFLARE_* variables as `drizzle-kit migrate`
 */
import { extract_tags } from '../src/lib/posts/text.ts'
import { literal, run } from './d1.ts'

let after = ''
let posts = 0
let tags = 0
for (;;) {
	// Keyset paging by id, so posts whose `#` or `＃` isn't a real tag are passed over, not
	// re-read.
	const rows = await run(
		`select id, body, created_at from post
		where (body like '%#%' or body like '%＃%') and id > ${literal(after)}
		order by id limit 500`,
	)
	if (!rows.length) break
	after = String(rows.at(-1)!.id)

	const values: string[] = []
	for (const row of rows) {
		posts += 1
		for (const tag of extract_tags(String(row.body))) {
			values.push(`(${literal(String(row.id))}, ${literal(tag)}, ${Number(row.created_at)})`)
			tags += 1
		}
	}
	for (let i = 0; i < values.length; i += 100) {
		await run(
			`insert or ignore into post_tag (post_id, tag, created_at) values ${values.slice(i, i + 100).join(', ')}`,
		)
	}
}
// Only the two counts are printed. They're counted up one at a time here, not taken from
// anything the database returned, so no text from the database can reach the log.
console.log(
	'Checked %d posts with a hashtag mark and %d tags; tags already saved were left as they were.',
	posts,
	tags,
)
