import { and, asc, desc, eq, gt, inArray, lt, or, sql, type SQL } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import type { FeedTab, PostPage, PostView } from '#lib/posts/types'
import type { getDb } from './db'
import { follow, post, postLike, profile, user } from './db/schema'

type Db = ReturnType<typeof getDb>

export const PAGE_SIZE = 20

const parent = alias(post, 'parent')
const parent_profile = alias(profile, 'parent_profile')

/**
 * Every post query goes through here: one statement returns the author, the parent's handle and
 * the counts, so a page of posts costs one D1 round trip no matter how long it is.
 */
function select_posts(db: Db, viewer: string | undefined) {
	return db
		.select({
			id: post.id,
			body: post.body,
			created_at: post.createdAt,
			edited_at: post.editedAt,
			reply_to_id: post.replyToId,
			author_id: user.id,
			author_name: sql<string>`coalesce(${profile.displayName}, ${user.name})`,
			author_handle: profile.handle,
			author_image: sql<string | null>`coalesce(${profile.avatarUrl}, ${user.image})`,
			parent_handle: parent_profile.handle,
			replies: sql<number>`(select count(*) from post r where r.reply_to_id = ${post.id})`,
			likes: sql<number>`(select count(*) from post_like l where l.post_id = ${post.id})`,
			liked: viewer
				? sql<number>`exists(select 1 from post_like l where l.post_id = ${post.id} and l.user_id = ${viewer})`
				: sql<number>`0`,
		})
		.from(post)
		.innerJoin(user, eq(user.id, post.authorId))
		.leftJoin(profile, eq(profile.userId, post.authorId))
		.leftJoin(parent, eq(parent.id, post.replyToId))
		.leftJoin(parent_profile, eq(parent_profile.userId, parent.authorId))
		.$dynamic()
}

type Row = Awaited<ReturnType<ReturnType<typeof select_posts>['execute']>>[number]

function to_view(row: Row, viewer: string | undefined): PostView {
	return {
		id: row.id,
		body: row.body,
		created_at: row.created_at.getTime(),
		edited: row.edited_at !== null,
		author: {
			id: row.author_id,
			name: row.author_name,
			handle: row.author_handle ?? undefined,
			image: row.author_image ?? undefined,
		},
		reply_to: row.reply_to_id
			? { id: row.reply_to_id, handle: row.parent_handle ?? undefined }
			: undefined,
		replies: row.replies,
		likes: row.likes,
		liked: !!row.liked,
		mine: row.author_id === viewer,
	}
}

/** Cursors are `createdAtMs:id`, so posts sharing a millisecond still page in a stable order. */
const encode_cursor = (view: PostView) => `${view.created_at}:${view.id}`

function decode_cursor(cursor: string) {
	const at = cursor.indexOf(':')
	const time = Number(cursor.slice(0, at))
	if (at < 1 || !Number.isSafeInteger(time)) return undefined
	return { created_at: new Date(time), id: cursor.slice(at + 1) }
}

/** Posts strictly after the cursor in the given direction. */
function after(cursor: string | undefined, direction: 'newer_first' | 'older_first') {
	const at = cursor ? decode_cursor(cursor) : undefined
	if (!at) return undefined
	const before = direction === 'newer_first' ? lt : gt
	return or(
		before(post.createdAt, at.created_at),
		and(eq(post.createdAt, at.created_at), before(post.id, at.id)),
	)
}

async function page(
	db: Db,
	viewer: string | undefined,
	where: (SQL | undefined)[],
	direction: 'newer_first' | 'older_first',
): Promise<PostPage> {
	const order = direction === 'newer_first' ? desc : asc
	const rows = await select_posts(db, viewer)
		.where(and(...where))
		.orderBy(order(post.createdAt), order(post.id))
		// One extra row says whether another page exists without a count query.
		.limit(PAGE_SIZE + 1)
	const posts = rows.slice(0, PAGE_SIZE).map((row) => to_view(row, viewer))
	const last = posts.at(-1)
	return { posts, next: rows.length > PAGE_SIZE && last ? encode_cursor(last) : undefined }
}

/**
 * Home timeline, newest first, top-level posts only. `for_you` is every post until there is a
 * ranking; `following` is the viewer's own posts plus the accounts they follow.
 */
export function feed_page(
	db: Db,
	viewer: string | undefined,
	tab: FeedTab,
	cursor: string | undefined,
) {
	const audience =
		tab === 'following' && viewer
			? or(
					eq(post.authorId, viewer),
					inArray(
						post.authorId,
						db.select({ id: follow.followingId }).from(follow).where(eq(follow.followerId, viewer)),
					),
				)
			: undefined
	return page(
		db,
		viewer,
		[eq(post.isReply, false), audience, after(cursor, 'newer_first')],
		'newer_first',
	)
}

/** Direct replies to a post, oldest first so a conversation reads top to bottom. */
export function replies_page(
	db: Db,
	viewer: string | undefined,
	post_id: string,
	cursor: string | undefined,
) {
	return page(
		db,
		viewer,
		[eq(post.replyToId, post_id), after(cursor, 'older_first')],
		'older_first',
	)
}

export async function find_post(db: Db, viewer: string | undefined, id: string) {
	const [row] = await select_posts(db, viewer).where(eq(post.id, id)).limit(1)
	return row ? to_view(row, viewer) : undefined
}

/** Publish a post, or undefined when the post it replies to no longer exists. */
export async function insert_post(
	db: Db,
	author_id: string,
	body: string,
	reply_to_id: string | undefined,
) {
	if (reply_to_id) {
		const [target] = await db
			.select({ id: post.id })
			.from(post)
			.where(eq(post.id, reply_to_id))
			.limit(1)
		if (!target) return undefined
	}
	const [created] = await db
		.insert(post)
		.values({ authorId: author_id, body, replyToId: reply_to_id ?? null, isReply: !!reply_to_id })
		.returning({ id: post.id })
	return created?.id
}

/** Replace the text of the author's own post. False when it isn't theirs or doesn't exist. */
export async function update_post(db: Db, author_id: string, id: string, body: string) {
	const updated = await db
		.update(post)
		.set({ body, editedAt: new Date() })
		.where(and(eq(post.id, id), eq(post.authorId, author_id)))
		.returning({ id: post.id })
	return updated.length > 0
}

/**
 * Delete the author's own post. Returns what it replied to, so that post's reply count can be
 * refreshed, or undefined when the post isn't theirs or doesn't exist.
 */
export async function remove_post(db: Db, author_id: string, id: string) {
	const [removed] = await db
		.delete(post)
		.where(and(eq(post.id, id), eq(post.authorId, author_id)))
		.returning({ reply_to_id: post.replyToId })
	return removed ? { reply_to_id: removed.reply_to_id ?? undefined } : undefined
}

/**
 * Like or unlike. Repeating either is a no-op, so double clicks and retries are safe, and liking
 * a post deleted a moment ago quietly does nothing instead of tripping the foreign key.
 */
export async function set_like(db: Db, user_id: string, post_id: string, on: boolean) {
	if (on) {
		await db.run(
			sql`insert or ignore into post_like (user_id, post_id) select ${user_id}, id from post where id = ${post_id}`,
		)
	} else {
		await db.delete(postLike).where(and(eq(postLike.userId, user_id), eq(postLike.postId, post_id)))
	}
}
