import { and, asc, desc, eq, gt, inArray, lt, lte, ne, or, sql, type SQL } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { extract_mentions, extract_tags } from '#lib/posts/text'
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
import {
	follow,
	poll,
	pollOption,
	post,
	postLike,
	postMedia,
	postTag,
	profile,
	user,
} from './db/schema'
import { notify, retract } from './notifications'

type Db = ReturnType<typeof getDb>

export const PAGE_SIZE = 20

const parent = alias(post, 'parent')
const parent_profile = alias(profile, 'parent_profile')

export const reply_count = sql<number>`(select count(*) from post r where r.reply_to_id = ${post.id})`
export const like_count = sql<number>`(select count(*) from post_like l where l.post_id = ${post.id})`

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
export function select_posts(db: Db, viewer: string | undefined) {
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
			? { id: row.reply_to_id, handle: row.parent_handle ?? undefined }
			: undefined,
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

/** The insert for a post's hashtags, which rides in the same batch as the post or the edit. */
function tag_inserts(db: Db, post_id: string, created_at: Date, body: string) {
	const tags = extract_tags(body)
	return tags.length
		? [
				db
					.insert(postTag)
					.values(tags.map((tag) => ({ postId: post_id, tag, createdAt: created_at }))),
			]
		: []
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

/**
 * After an edit: notify people it newly mentions, and take the notification back from people it
 * no longer mentions, so fixing a typo doesn't ping everyone again.
 */
async function update_mentions(
	db: Db,
	author_id: string,
	post_id: string,
	before: { body: string; reply_to_id: string | null },
	body: string,
) {
	const already = new Set(extract_mentions(before.body))
	const now = new Set(extract_mentions(body))
	const dropped = [...already].filter((handle) => !now.has(handle))
	for (const user_id of await mentioned_users(db, dropped, author_id)) {
		await retract(db, { user_id, actor_id: author_id, type: 'mention', post_id })
	}
	const added = [...now].filter((handle) => !already.has(handle))
	if (!added.length) return
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
		mentioned.map((user_id) => ({ user_id, actor_id: author_id, type: 'mention', post_id })),
	)
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
	const id = crypto.randomUUID()
	// Set here rather than by the database, so the post's tags carry the very same time.
	const created_at = new Date()
	await db.batch([
		db.insert(post).values({
			id,
			authorId: author_id,
			body: input.body,
			location: input.location ?? null,
			replyToId: reply_to_id ?? null,
			isReply: !!reply_to_id,
			createdAt: created_at,
		}),
		...attachment_inserts(db, id, input),
		...tag_inserts(db, id, created_at, input.body),
	])

	// Someone mentioned in a reply to their own post already hears about it as a reply.
	const mentioned = await mentioned_users(
		db,
		extract_mentions(input.body),
		author_id,
		parent_author,
	)
	await notify(db, [
		...(parent_author
			? [{ user_id: parent_author, actor_id: author_id, type: 'reply' as const, post_id: id }]
			: []),
		...mentioned.map((user_id) => ({
			user_id,
			actor_id: author_id,
			type: 'mention' as const,
			post_id: id,
		})),
	])
	return id
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
 * their files can go. Its hashtags follow the new text, and mentions are updated.
 */
export async function update_post(
	db: Db,
	author_id: string,
	id: string,
	body: string,
	media?: KeptMedia[],
): Promise<EditResult> {
	const [owned] = await db
		.select({ body: post.body, created_at: post.createdAt, reply_to_id: post.replyToId })
		.from(post)
		.where(and(eq(post.id, id), eq(post.authorId, author_id)))
		.limit(1)
	if (!owned) return 'not_found'

	const current = await db.select().from(postMedia).where(eq(postMedia.postId, id))
	const kept = media ? kept_media(current, media) : current
	if (!kept || post_problem(body, kept.length > 0)) return 'invalid'

	const edit = db.update(post).set({ body, editedAt: new Date() }).where(eq(post.id, id))
	// The post's hashtags are rewritten with the text, in the same batch.
	const retag = [
		db.delete(postTag).where(eq(postTag.postId, id)),
		...tag_inserts(db, id, owned.created_at, body),
	]
	if (!media) {
		await db.batch([edit, ...retag])
		await update_mentions(db, author_id, id, owned, body)
		return { removed_uploads: [] }
	}
	await db.batch([
		edit,
		...retag,
		db.delete(postMedia).where(eq(postMedia.postId, id)),
		...(kept.length
			? [db.insert(postMedia).values(kept.map((item, position) => ({ ...item, position })))]
			: []),
	])
	await update_mentions(db, author_id, id, owned, body)
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
