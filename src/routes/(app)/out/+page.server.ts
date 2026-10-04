import { error, redirect } from '@sveltejs/kit'
import { is_blocked_link } from '#lib/posts/blocked'
import { text_segments } from '#lib/posts/text'
import { find_post } from '#lib/server/posts'
import type { PageServerLoad } from './$types'
import { login_href } from '../../(public)/links'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * "You're leaving Jiyuu", for links in a new account's posts. It is given a post and the index of
 * a link in it, never a URL, so it only ever leads where a post the reader can see already points.
 */
export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) return redirect(302, login_href(url))
	const id = url.searchParams.get('post') ?? ''
	const n = Number(url.searchParams.get('n'))
	if (!UUID.test(id) || !Number.isInteger(n) || n < 0) error(404, 'Not found.')
	const post = await find_post(locals.db, locals.user.id, id)
	const href = post && text_segments(post.body).filter((segment) => segment.href)[n]?.href
	if (!post || !href || is_blocked_link(href, post.blocked_hosts)) error(404, 'Not found.')
	return { href, host: new URL(href).hostname, post_id: post.id }
}
