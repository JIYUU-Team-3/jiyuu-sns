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
	isPrivate: integer('is_private', { mode: 'boolean' }).notNull().default(false),
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
		replyAudience: text('reply_audience', { enum: ['everyone', 'following', 'mentioned'] })
			.notNull()
			.default('everyone'),
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

export const followRequest = sqliteTable(
	'follow_request',
	{
		requesterId: text('requester_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		targetId: text('target_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		createdAt: created_at(),
	},
	(table) => [
		primaryKey({ columns: [table.requesterId, table.targetId] }),
		index('follow_request_target_idx').on(table.targetId, table.createdAt),
	],
)

export const block = sqliteTable(
	'block',
	{
		blockerId: text('blocker_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		blockedId: text('blocked_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		createdAt: created_at(),
	},
	(table) => [
		primaryKey({ columns: [table.blockerId, table.blockedId] }),
		index('block_blocked_idx').on(table.blockedId),
	],
)

export const mute = sqliteTable(
	'mute',
	{
		muterId: text('muter_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		mutedId: text('muted_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		createdAt: created_at(),
	},
	(table) => [primaryKey({ columns: [table.muterId, table.mutedId] })],
)

export const mutedTerm = sqliteTable(
	'muted_term',
	{
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		term: text('term').notNull(),
		createdAt: created_at(),
	},
	(table) => [primaryKey({ columns: [table.userId, table.term] })],
)

export const report = sqliteTable(
	'report',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		reporterId: text('reporter_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		postId: text('post_id').references(() => post.id, { onDelete: 'set null' }),
		reason: text('reason', {
			enum: ['spam', 'harassment', 'hate', 'violence', 'sexual', 'self_harm', 'other'],
		}).notNull(),
		note: text('note').notNull().default(''),
		createdAt: created_at(),
	},
	(table) => [
		index('report_reporter_idx').on(table.reporterId, table.userId),
		index('report_created_idx').on(table.createdAt),
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

/** One row per distinct #tag in a post, rewritten whenever the post is edited. */
export const postTag = sqliteTable(
	'post_tag',
	{
		postId: text('post_id')
			.notNull()
			.references(() => post.id, { onDelete: 'cascade' }),
		// Lowercase and NFKC-normalised, without the `#`.
		tag: text('tag').notNull(),
		// The post's own creation time, so trending can count a window without joining `post`.
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.postId, table.tag] }),
		index('post_tag_tag_created_idx').on(table.tag, table.createdAt),
	],
)

export const notification = sqliteTable(
	'notification',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		/** Who sees it. */
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		/** Who did it. */
		actorId: text('actor_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		type: text('type', {
			enum: ['follow', 'like', 'reply', 'mention', 'follow_request'],
		}).notNull(),
		// The liked post, or the reply or mention itself. Null for a follow.
		postId: text('post_id').references(() => post.id, { onDelete: 'cascade' }),
		readAt: integer('read_at', { mode: 'timestamp_ms' }),
		createdAt: created_at(),
	},
	(table) => [index('notification_user_created_idx').on(table.userId, table.createdAt)],
)

/** One browser that turned on push notifications. An account can have several. */
export const pushSubscription = sqliteTable(
	'push_subscription',
	{
		// The push service URL is unique per browser, so re-subscribing replaces the row.
		endpoint: text('endpoint').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		/** The browser's public key and auth secret, base64url, for encrypting messages to it. */
		p256dh: text('p256dh').notNull(),
		auth: text('auth').notNull(),
		/** The language the notifications are written in: the one in use when it was turned on. */
		locale: text('locale').notNull(),
		createdAt: created_at(),
	},
	(table) => [index('push_subscription_user_idx').on(table.userId)],
)

export const conversation = sqliteTable('conversation', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text('name'),
	isGroup: integer('is_group', { mode: 'boolean' }).notNull().default(false),
	directKey: text('direct_key').unique(),
	createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
	lastMessageAt: integer('last_message_at', { mode: 'timestamp_ms' }),
	createdAt: created_at(),
})

export const conversationMember = sqliteTable(
	'conversation_member',
	{
		conversationId: text('conversation_id')
			.notNull()
			.references(() => conversation.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		lastReadAt: integer('last_read_at', { mode: 'timestamp_ms' }),
		lastDeliveredAt: integer('last_delivered_at', { mode: 'timestamp_ms' }),
		createdAt: created_at(),
	},
	(table) => [
		primaryKey({ columns: [table.conversationId, table.userId] }),
		index('conversation_member_user_idx').on(table.userId),
	],
)

export const message = sqliteTable(
	'message',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		conversationId: text('conversation_id')
			.notNull()
			.references(() => conversation.id, { onDelete: 'cascade' }),
		senderId: text('sender_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		body: text('body').notNull().default(''),
		replyToId: text('reply_to_id').references((): AnySQLiteColumn => message.id, {
			onDelete: 'set null',
		}),
		mediaKind: text('media_kind', { enum: ['image', 'gif'] }),
		mediaUrl: text('media_url'),
		mediaWidth: integer('media_width'),
		mediaHeight: integer('media_height'),
		createdAt: created_at(),
	},
	(table) => [
		index('message_conversation_created_idx').on(table.conversationId, table.createdAt),
		index('message_media_url_idx').on(table.mediaUrl),
	],
)

export const messageReaction = sqliteTable(
	'message_reaction',
	{
		messageId: text('message_id')
			.notNull()
			.references(() => message.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		emoji: text('emoji').notNull(),
		createdAt: created_at(),
	},
	(table) => [primaryKey({ columns: [table.messageId, table.userId] })],
)

export * from './auth.schema'
