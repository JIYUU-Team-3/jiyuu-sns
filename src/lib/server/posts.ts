import { and, asc, desc, eq, gt, inArray, lt, lte, ne, or, sql, type SQL } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { post_problem, type PollDays } from '#lib/posts/rules'
import {
	is_upload,
	type FeedTab,
	type Media,
	type PollView,
	type PostPage,
	type PostView,
} from '#lib/posts/types'
import type { getDb } from './db'
import { follow, poll, pollOption, post, postLike, postMedia, profile, user } from './db/schema'

type Db = ReturnType<typeof getDb>

export const PAGE_SIZE = 20

const parent = alias(post, 'parent')
const parent_profile = alias(profile, 'parent_profile')

const reply_count = sql<number>`(select count(*) from post r where r.reply_to_id = ${post.id})`
const like_count = sql<number>`(select count(*) from post_like l where l.post_id = ${post.id})`
const continued = sql<number>`exists(select 1 from post r where r.reply_to_id = ${post.id} and r.author_id = ${post.authorId})`

const THREAD_DEPTH = 100

// Attachments come back as JSON arrays from correlated subqueries, so a page stays one statement.
const media_json = sql<string>`(select json_group_array(json_object(
	'position', m.position, 'kind', m.kind, 'url', m.url, 'width', m.width, 'height', m.height,
	'alt', m.alt
)) from post_media m where m.post_id = ${post.id})`
const poll_json = sql<string>`(select json_group_array(json_object(
	'position', o.position, 'label', o.label,
	'votes', (select count(*) from poll_vote v where v.post_id = o.post_id and v.position = o.position)
)) from poll_option o where o.post_id = ${post.id})`

const poll_voted = (viewer: string | undefined) =>
	viewer
		? sql<
				number | null
			>`(select v.position from poll_vote v where v.post_id = ${post.id} and v.user_id = ${viewer})`
		: sql<number | null>`null`

/**
 * Every post query goes through here: one statement returns the author, the parent's handle,
 * the attachments and the counts, so a page of posts costs one D1 round trip no matter how long
 * it is.
 */
function select_posts(db: Db, viewer: string | undefined) {
	return db
		.select({
			id: post.id,
			body: post.body,
			created_at: post.createdAt,
			edited_at: post.editedAt,
			reply_to_id: post.replyToId,
			location: post.location,
			media: media_json,
			poll_ends_at: poll.endsAt,
			poll_options: poll_json,
			poll_voted: poll_voted(viewer),
			author_id: user.id,
			author_name: sql<string>`coalesce(${profile.displayName}, ${user.name})`,
			author_handle: profile.handle,
			author_image: sql<string | null>`coalesce(${profile.avatarUrl}, ${user.image})`,
			parent_handle: parent_profile.handle,
			parent_author_id: parent.authorId,
			continued,
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
		.leftJoin(poll, eq(poll.postId, post.id))
		.$dynamic()
}

type Row = Awaited<ReturnType<ReturnType<typeof select_posts>['execute']>>[number]

/** A JSON array from the query, in the order the author gave it, without the position. */
function by_position<T>(json: string | null): T[] {
	const items: (T & { position: number })[] = JSON.parse(json ?? '[]')
	return items
		.sort((a, b) => a.position - b.position)
		.map(({ position, ...item }) => (void position, item as T))
}

/** SQL hands back a missing description as null; the client only knows set or unset. */
function to_media(json: string | null): Media[] {
	return by_position<Media & { alt: string | null }>(json).map(({ alt, ...item }) =>
		alt ? { ...item, alt } : item,
	)
}

function to_poll(row: Row): PollView | undefined {
	if (!row.poll_ends_at) return undefined
	return {
		options: by_position(row.poll_options),
		ends_at: row.poll_ends_at.getTime(),
		voted: row.poll_voted ?? undefined,
	}
}

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
			? {
					id: row.reply_to_id,
					handle: row.parent_handle ?? undefined,
					self: row.parent_author_id === row.author_id,
				}
			: undefined,
		continued: !!row.continued,
		media: to_media(row.media),
		poll: to_poll(row),
		location: row.location ?? undefined,
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

function to_page(rows: Row[], viewer: string | undefined, next: (last: PostView) => string) {
	const posts = rows.slice(0, PAGE_SIZE).map((row) => to_view(row, viewer))
	const last = posts.at(-1)
	return { posts, next: rows.length > PAGE_SIZE && last ? next(last) : undefined }
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

export async function conversation(db: Db, viewer: string | undefined, id: string) {
	const above = sql`(with recursive up(id, depth) as (
		select reply_to_id, 1 from post where id = ${id}
		union all
		select p.reply_to_id, up.depth + 1 from post p join up on p.id = up.id
		where up.depth < ${THREAD_DEPTH}
	) select id from up where id is not null)`
	const below = sql`(with recursive down(id, author_id, depth) as (
		select id, author_id, 0 from post where id = ${id}
		union all
		select r.id, r.author_id, down.depth + 1 from down join post r on r.id = (
			select n.id from post n where n.reply_to_id = down.id and n.author_id = down.author_id
			order by n.created_at, n.id limit 1
		)
		where down.depth < ${THREAD_DEPTH}
	) select id from down where depth > 0)`
	const [up, down] = await Promise.all([
		select_posts(db, viewer)
			.where(inArray(post.id, above))
			.orderBy(asc(post.createdAt), asc(post.id)),
		select_posts(db, viewer)
			.where(inArray(post.id, below))
			.orderBy(asc(post.createdAt), asc(post.id)),
	])
	return {
		above: up.map((row) => to_view(row, viewer)),
		below: down.map((row) => to_view(row, viewer)),
	}
}

export async function find_post(db: Db, viewer: string | undefined, id: string) {
	const [row] = await select_posts(db, viewer).where(eq(post.id, id)).limit(1)
	return row ? to_view(row, viewer) : undefined
}

/** A checked post as the composer sends it; photo URLs must already be the author's uploads. */
export type NewPost = {
	body: string
	media: Media[]
	poll?: { options: string[]; days: PollDays }
	location?: string
}

const DAY_MS = 24 * 60 * 60 * 1000

/** The inserts for a post's photos and poll, which ride in the same batch as the post. */
function attachment_inserts(db: Db, post_id: string, input: NewPost) {
	const inserts = []
	if (input.media.length) {
		inserts.push(
			db
				.insert(postMedia)
				.values(input.media.map((media, position) => ({ postId: post_id, position, ...media }))),
		)
	}
	if (input.poll) {
		const ends_at = new Date(Date.now() + input.poll.days * DAY_MS)
		inserts.push(db.insert(poll).values({ postId: post_id, endsAt: ends_at }))
		inserts.push(
			db
				.insert(pollOption)
				.values(
					input.poll.options.map((label, position) => ({ postId: post_id, position, label })),
				),
		)
	}
	return inserts
}

/**
 * Publish a post with its attachments in one batch, so a failure leaves nothing half-written.
 * Undefined when the post it replies to no longer exists.
 */
export async function insert_post(
	db: Db,
	author_id: string,
	input: NewPost,
	reply_to_id: string | undefined,
) {
	const ids = await insert_thread(db, author_id, [input], reply_to_id)
	return ids?.[0]
}

export async function insert_thread(
	db: Db,
	author_id: string,
	inputs: NewPost[],
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
	const ids = inputs.map(() => crypto.randomUUID())
	const now = Date.now()
	const [first, ...rest] = inputs.flatMap((input, i) => {
		const parent_id = i ? ids[i - 1] : reply_to_id
		return [
			db.insert(post).values({
				id: ids[i],
				authorId: author_id,
				body: input.body,
				location: input.location ?? null,
				replyToId: parent_id ?? null,
				isReply: !!parent_id,
				createdAt: new Date(now + i),
			}),
			...attachment_inserts(db, ids[i], input),
		]
	})
	await db.batch([first, ...rest])
	return ids
}

/** One photo, GIF or video an edit keeps: which one, by URL, and its description now. */
export type KeptMedia = { url: string; alt?: string }

/**
 * The media an edit keeps, in the new order, with the descriptions it sets: `wanted` lists URLs
 * the post already has, so an edit can drop, reorder, or describe photos but never add one.
 * Undefined when `wanted` isn't that.
 */
export function kept_media<T extends { url: string }>(current: T[], wanted: KeptMedia[]) {
	if (new Set(wanted.map((item) => item.url)).size !== wanted.length) return undefined
	const kept = wanted.map(({ url, alt }) => {
		const item = current.find((other) => other.url === url)
		return item && { ...item, alt: alt ?? null }
	})
	return kept.every((item) => item !== undefined) ? kept : undefined
}

export type EditResult = 'not_found' | 'invalid' | { removed_uploads: string[] }

/**
 * Replace the text of the author's own post and, when `media` is given, keep only those photos,
 * GIFs and videos, in that order, with those descriptions. Returns the upload URLs it dropped, so
 * their files can go.
 */
export async function update_post(
	db: Db,
	author_id: string,
	id: string,
	body: string,
	media?: KeptMedia[],
): Promise<EditResult> {
	const [owned] = await db
		.select({ id: post.id })
		.from(post)
		.where(and(eq(post.id, id), eq(post.authorId, author_id)))
		.limit(1)
	if (!owned) return 'not_found'

	const current = await db.select().from(postMedia).where(eq(postMedia.postId, id))
	const kept = media ? kept_media(current, media) : current
	if (!kept || post_problem(body, kept.length > 0)) return 'invalid'

	const edit = db.update(post).set({ body, editedAt: new Date() }).where(eq(post.id, id))
	if (!media) {
		await edit
		return { removed_uploads: [] }
	}
	await db.batch([
		edit,
		db.delete(postMedia).where(eq(postMedia.postId, id)),
		...(kept.length
			? [db.insert(postMedia).values(kept.map((item, position) => ({ ...item, position })))]
			: []),
	])
	const kept_urls = new Set(kept.map((item) => item.url))
	const removed = current.filter((item) => is_upload(item.kind) && !kept_urls.has(item.url))
	return { removed_uploads: removed.map((item) => item.url) }
}

/**
 * Delete the author's own post. Returns what it replied to, so that post's reply count can be
 * refreshed, and its photo and video URLs, so their files can be removed; undefined when the post isn't
 * theirs or doesn't exist.
 */
export async function remove_post(db: Db, author_id: string, id: string) {
	const uploads = await db
		.select({ url: postMedia.url })
		.from(postMedia)
		.where(and(eq(postMedia.postId, id), ne(postMedia.kind, 'gif')))
	const [removed] = await db
		.delete(post)
		.where(and(eq(post.id, id), eq(post.authorId, author_id)))
		.returning({ reply_to_id: post.replyToId })
	if (!removed) return undefined
	return { reply_to_id: removed.reply_to_id ?? undefined, uploads: uploads.map((u) => u.url) }
}

/**
 * Which of `urls` no post uses any more, so their files can go. One upload can sit on several
 * posts, so dropping it from one must not delete it from under the others.
 */
export async function unused_uploads(db: Db, urls: string[]) {
	if (!urls.length) return []
	const used = await db
		.selectDistinct({ url: postMedia.url })
		.from(postMedia)
		.where(inArray(postMedia.url, urls))
	const used_urls = new Set(used.map((row) => row.url))
	return urls.filter((url) => !used_urls.has(url))
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

/**
 * Vote once in an open poll. A repeat vote, a closed poll or a missing choice quietly does
 * nothing; the refreshed post shows what actually counted.
 */
export async function vote(db: Db, user_id: string, post_id: string, position: number) {
	await db.run(sql`insert or ignore into poll_vote (post_id, user_id, position)
		select o.post_id, ${user_id}, o.position from poll_option o
		join poll p on p.post_id = o.post_id
		where o.post_id = ${post_id} and o.position = ${position} and p.ends_at > ${Date.now()}`)
}
