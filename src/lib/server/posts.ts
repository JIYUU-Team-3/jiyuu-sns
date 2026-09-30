import { and, asc, desc, eq, gt, inArray, lt, lte, or, sql, type SQL } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { extract_mentions, extract_tags } from '#lib/posts/text'
import type { FeedTab, PostPage, PostView } from '#lib/posts/types'
import type { getDb } from './db'
import { follow, post, postLike, postTag, profile, user } from './db/schema'
import { notify, retract } from './notifications'

type Db = ReturnType<typeof getDb>

export const PAGE_SIZE = 20

const parent = alias(post, 'parent')
const parent_profile = alias(profile, 'parent_profile')

export const reply_count = sql<number>`(select count(*) from post r where r.reply_to_id = ${post.id})`
export const like_count = sql<number>`(select count(*) from post_like l where l.post_id = ${post.id})`

/**
 * Every post query goes through here: one statement returns the author, the parent's handle and
 * the counts, so a page of posts costs one D1 round trip no matter how long it is.
 */
export function select_posts(db: Db, viewer: string | undefined) {
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
			replies: reply_count,
			likes: like_count,
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
export function after(cursor: string | undefined, direction: 'newer_first' | 'older_first') {
	const at = cursor ? decode_cursor(cursor) : undefined
	if (!at) return undefined
	const before = direction === 'newer_first' ? lt : gt
	return or(
		before(post.createdAt, at.created_at),
		and(eq(post.createdAt, at.created_at), before(post.id, at.id)),
	)
}

export function to_page(rows: Row[], viewer: string | undefined, next: (last: PostView) => string) {
	const posts = rows.slice(0, PAGE_SIZE).map((row) => to_view(row, viewer))
	const last = posts.at(-1)
	return { posts, next: rows.length > PAGE_SIZE && last ? next(last) : undefined }
}

export async function page(
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
	return to_page(rows, viewer, encode_cursor)
}

function decode_rank_cursor(cursor: string | undefined) {
	const [as_of, offset] = (cursor ?? '').split(':').map(Number)
	if (!Number.isSafeInteger(as_of) || !Number.isSafeInteger(offset) || offset < 0) return undefined
	return { as_of, offset }
}

async function ranked_page(
	db: Db,
	viewer: string | undefined,
	cursor: string | undefined,
): Promise<PostPage> {
	const { as_of, offset } = decode_rank_cursor(cursor) ?? { as_of: Date.now(), offset: 0 }
	const followed = viewer
		? sql`exists(select 1 from follow f where f.follower_id = ${viewer} and f.following_id = ${post.authorId})`
		: sql`0`
	const age = sql`((${as_of} - ${post.createdAt}) / 3600000.0 + 2)`
	const score = sql`(1.0 + ${like_count} + 2 * ${reply_count} + 3 * ${followed}) / (${age} * ${age})`
	const rows = await select_posts(db, viewer)
		.where(and(eq(post.isReply, false), lte(post.createdAt, new Date(as_of))))
		.orderBy(desc(score), desc(post.createdAt), desc(post.id))
		.limit(PAGE_SIZE + 1)
		.offset(offset)
	return to_page(rows, viewer, () => `${as_of}:${offset + PAGE_SIZE}`)
}

export function feed_page(
	db: Db,
	viewer: string | undefined,
	tab: FeedTab,
	cursor: string | undefined,
) {
	if (tab === 'for_you') return ranked_page(db, viewer, cursor)
	const audience = viewer
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

/** One author's posts, newest first: top-level posts, or only their replies. */
export function author_page(
	db: Db,
	viewer: string | undefined,
	author_id: string,
	replies: boolean,
	cursor: string | undefined,
) {
	return page(
		db,
		viewer,
		[eq(post.authorId, author_id), eq(post.isReply, replies), after(cursor, 'newer_first')],
		'newer_first',
	)
}

export async function find_post(db: Db, viewer: string | undefined, id: string) {
	const [row] = await select_posts(db, viewer).where(eq(post.id, id)).limit(1)
	return row ? to_view(row, viewer) : undefined
}

/** Several posts by id, in no particular order; missing ones are left out. */
export async function find_posts(db: Db, viewer: string | undefined, ids: string[]) {
	if (!ids.length) return []
	const rows = await select_posts(db, viewer).where(inArray(post.id, ids))
	return rows.map((row) => to_view(row, viewer))
}

/** Replace a post's hashtags with the ones in `body`. */
async function save_tags(db: Db, post_id: string, created_at: Date, body: string) {
	const tags = extract_tags(body)
	await db.delete(postTag).where(eq(postTag.postId, post_id))
	if (tags.length) {
		await db
			.insert(postTag)
			.values(tags.map((tag) => ({ postId: post_id, tag, createdAt: created_at })))
	}
}

/** The accounts behind the handles a post mentions, leaving out the author and `skip`. */
async function mentioned_users(db: Db, handles: string[], author_id: string, skip?: string) {
	if (!handles.length) return []
	const rows = await db
		.select({ id: profile.userId })
		.from(profile)
		.where(inArray(profile.handle, handles))
	return rows.map((row) => row.id).filter((id) => id !== author_id && id !== skip)
}

/** Publish a post, or undefined when the post it replies to no longer exists. */
export async function insert_post(
	db: Db,
	author_id: string,
	body: string,
	reply_to_id: string | undefined,
) {
	let parent_author: string | undefined
	if (reply_to_id) {
		const [target] = await db
			.select({ author_id: post.authorId })
			.from(post)
			.where(eq(post.id, reply_to_id))
			.limit(1)
		if (!target) return undefined
		parent_author = target.author_id
	}
	const [created] = await db
		.insert(post)
		.values({ authorId: author_id, body, replyToId: reply_to_id ?? null, isReply: !!reply_to_id })
		.returning({ id: post.id, created_at: post.createdAt })
	if (!created) return undefined

	await save_tags(db, created.id, created.created_at, body)
	// Someone mentioned in a reply to their own post already hears about it as a reply.
	const mentioned = await mentioned_users(db, extract_mentions(body), author_id, parent_author)
	await notify(db, [
		...(parent_author
			? [
					{
						user_id: parent_author,
						actor_id: author_id,
						type: 'reply' as const,
						post_id: created.id,
					},
				]
			: []),
		...mentioned.map((user_id) => ({
			user_id,
			actor_id: author_id,
			type: 'mention' as const,
			post_id: created.id,
		})),
	])
	return created.id
}

/**
 * Replace the text of the author's own post. False when it isn't theirs or doesn't exist.
 * Only people newly mentioned by the edit are notified, so fixing a typo doesn't ping everyone
 * again, and people it no longer mentions lose that notification.
 */
export async function update_post(db: Db, author_id: string, id: string, body: string) {
	const [before] = await db
		.select({ body: post.body, created_at: post.createdAt, reply_to_id: post.replyToId })
		.from(post)
		.where(and(eq(post.id, id), eq(post.authorId, author_id)))
		.limit(1)
	if (!before) return false
	const updated = await db
		.update(post)
		.set({ body, editedAt: new Date() })
		.where(and(eq(post.id, id), eq(post.authorId, author_id)))
		.returning({ id: post.id })
	if (!updated.length) return false

	await save_tags(db, id, before.created_at, body)
	const already = new Set(extract_mentions(before.body))
	const now = new Set(extract_mentions(body))
	const added = [...now].filter((handle) => !already.has(handle))

	// Someone the edit no longer mentions shouldn't keep a notification for it.
	const dropped = [...already].filter((handle) => !now.has(handle))
	for (const user_id of await mentioned_users(db, dropped, author_id)) {
		await retract(db, { user_id, actor_id: author_id, type: 'mention', post_id: id })
	}

	const [parent] = before.reply_to_id
		? await db
				.select({ author_id: post.authorId })
				.from(post)
				.where(eq(post.id, before.reply_to_id))
				.limit(1)
		: []
	const mentioned = await mentioned_users(db, added, author_id, parent?.author_id)
	await notify(
		db,
		mentioned.map((user_id) => ({ user_id, actor_id: author_id, type: 'mention', post_id: id })),
	)
	return true
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
	const [target] = await db
		.select({ author_id: post.authorId })
		.from(post)
		.where(eq(post.id, post_id))
		.limit(1)
	if (!target) return
	const note = { user_id: target.author_id, actor_id: user_id, type: 'like' as const, post_id }
	if (on) {
		// Only a like that is actually new is announced; a repeated one inserts nothing.
		const added = await db.all(
			sql`insert or ignore into post_like (user_id, post_id) select ${user_id}, id from post where id = ${post_id} returning post_id`,
		)
		if (added.length) await notify(db, [note])
	} else {
		await db.delete(postLike).where(and(eq(postLike.userId, user_id), eq(postLike.postId, post_id)))
		await retract(db, note)
	}
}
