import { sql } from 'drizzle-orm'
import {
	type AnySQLiteColumn,
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
} from 'drizzle-orm/sqlite-core'
import { user } from './auth.schema'

/** Same `timestamp_ms` style as the generated auth tables. */
const created_at = () =>
	integer('created_at', { mode: 'timestamp_ms' })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull()

/** The public side of an account: 1:1 with `user`, written by onboarding. */
export const profile = sqliteTable('profile', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	handle: text('handle').notNull().unique(),
	displayName: text('display_name').notNull(),
	bio: text('bio').notNull().default(''),
	/** A `/media/…` upload, or null to fall back to the account's Google photo. */
	avatarUrl: text('avatar_url'),
	/** A `/media/…` upload, or null for the plain fallback colour. */
	bannerUrl: text('banner_url'),
	createdAt: created_at(),
})

export const post = sqliteTable(
	'post',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		authorId: text('author_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		body: text('body').notNull(),
		// Replies are posts. Deleting a parent keeps other people's replies; they lose the link.
		replyToId: text('reply_to_id').references((): AnySQLiteColumn => post.id, {
			onDelete: 'set null',
		}),
		// Stays true after the parent is deleted, so an orphaned reply never surfaces in timelines.
		isReply: integer('is_reply', { mode: 'boolean' }).notNull().default(false),
		/** A place name picked from the location search, shown under the post. */
		location: text('location'),
		createdAt: created_at(),
		// Set only by an edit, so the "Edited" label never comes from an unrelated write.
		editedAt: integer('edited_at', { mode: 'timestamp_ms' }),
	},
	(table) => [
		index('post_author_created_idx').on(table.authorId, table.createdAt),
		index('post_reply_to_created_idx').on(table.replyToId, table.createdAt),
		index('post_timeline_idx').on(table.isReply, table.createdAt),
	],
)

/** Photos, GIFs and videos on a post, in the order the author picked them. */
export const postMedia = sqliteTable(
	'post_media',
	{
		postId: text('post_id')
			.notNull()
			.references(() => post.id, { onDelete: 'cascade' }),
		position: integer('position').notNull(),
		/** `image` and `video` are uploads in R2; `gif` is a GIF from the picker's CDN. */
		kind: text('kind', { enum: ['image', 'gif', 'video'] }).notNull(),
		url: text('url').notNull(),
		width: integer('width').notNull(),
		height: integer('height').notNull(),
		/** The author's description for screen readers; null when they didn't write one. */
		alt: text('alt'),
	},
	(table) => [primaryKey({ columns: [table.postId, table.position] })],
)

export const poll = sqliteTable('poll', {
	postId: text('post_id')
		.primaryKey()
		.references(() => post.id, { onDelete: 'cascade' }),
	endsAt: integer('ends_at', { mode: 'timestamp_ms' }).notNull(),
})

export const pollOption = sqliteTable(
	'poll_option',
	{
		postId: text('post_id')
			.notNull()
			.references(() => poll.postId, { onDelete: 'cascade' }),
		position: integer('position').notNull(),
		label: text('label').notNull(),
	},
	(table) => [primaryKey({ columns: [table.postId, table.position] })],
)

/** One vote per person per poll, so a vote can't be changed or repeated. */
export const pollVote = sqliteTable(
	'poll_vote',
	{
		postId: text('post_id')
			.notNull()
			.references(() => poll.postId, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		position: integer('position').notNull(),
		createdAt: created_at(),
	},
	(table) => [
		primaryKey({ columns: [table.postId, table.userId] }),
		index('poll_vote_option_idx').on(table.postId, table.position),
	],
)

export const follow = sqliteTable(
	'follow',
	{
		followerId: text('follower_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		followingId: text('following_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		createdAt: created_at(),
	},
	(table) => [
		primaryKey({ columns: [table.followerId, table.followingId] }),
		index('follow_following_idx').on(table.followingId),
	],
)

export const postLike = sqliteTable(
	'post_like',
	{
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		postId: text('post_id')
			.notNull()
			.references(() => post.id, { onDelete: 'cascade' }),
		createdAt: created_at(),
	},
	(table) => [
		primaryKey({ columns: [table.userId, table.postId] }),
		index('post_like_post_idx').on(table.postId),
	],
)

export * from './auth.schema'
