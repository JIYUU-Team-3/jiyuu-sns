import { sql } from 'drizzle-orm'
import {
	type AnySQLiteColumn,
	index,
	integer,
	primaryKey,
	sqliteTable,
	uniqueIndex,
	text,
} from 'drizzle-orm/sqlite-core'
import { AUDIENCES } from '../../profiles/details'
import { user } from './auth.schema'

/** Same `timestamp_ms` style as the generated auth tables, set when the row is written. */
const written_at = (name: string) =>
	integer(name, { mode: 'timestamp_ms' })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull()

const created_at = () => written_at('created_at')

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
	/** Free text, or a place picked from the OpenStreetMap search; empty when not given. */
	location: text('location').notNull().default(''),
	/** `YYYY-MM-DD`, or null when not given. Who sees which part is the two settings below. */
	birthDate: text('birth_date'),
	/** Who sees the month and day. */
	birthdayAudience: text('birthday_audience', { enum: AUDIENCES }).notNull().default('followers'),
	/** Who sees the year. */
	birthYearAudience: text('birth_year_audience', { enum: AUDIENCES }).notNull().default('only_me'),
	/** The post shown first on the profile; only ever the account's own. Cleared with the post. */
	pinnedPostId: text('pinned_post_id').references((): AnySQLiteColumn => post.id, {
		onDelete: 'set null',
	}),
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
		// The post this one quotes. No foreign key: a quote outlives the post it quotes and then
		// says that post is unavailable, so the id must stay. Checked to exist when quoting.
		quoteId: text('quote_id'),
		createdAt: created_at(),
		// Set only by an edit, so the "Edited" label never comes from an unrelated write.
		editedAt: integer('edited_at', { mode: 'timestamp_ms' }),
		/**
		 * `limited` waits for a moderator and `removed` was taken down; both are shown to their author
		 * only. See `shown_to` in `server/posts.ts` and docs/MODERATION.md.
		 */
		moderation: text('moderation', { enum: ['visible', 'limited', 'removed'] })
			.notNull()
			.default('visible'),
		/** Media blurred until the viewer chooses to see it. Set by the author or a moderator. */
		sensitive: integer('sensitive', { mode: 'boolean' }).notNull().default(false),
		/** When a moderator removed it; the post is deleted for good a day later, unless appealed. */
		removedAt: integer('removed_at', { mode: 'timestamp_ms' }),
		/**
		 * The automatic checks: `pending` until they run, `unchecked` when they couldn't (no budget,
		 * no answer) and the hourly job should try again, `skipped` when there was nothing for them.
		 * Posts from before the checks existed are `skipped`, so they're never queued all at once.
		 */
		checked: text('checked', { enum: ['pending', 'checked', 'unchecked', 'skipped'] })
			.notNull()
			.default('skipped'),
	},
	(table) => [
		index('post_author_created_idx').on(table.authorId, table.createdAt),
		index('post_reply_to_created_idx').on(table.replyToId, table.createdAt),
		index('post_timeline_idx').on(table.isReply, table.createdAt),
		// The hourly job's retry of posts the checks couldn't finish.
		index('post_checked_idx').on(table.checked, table.createdAt),
		index('post_quote_idx').on(table.quoteId),
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
		// From the file attachments that were taken out again. Nothing writes these; they stay so
		// the schema matches the database, where migration 0010 already added them.
		name: text('name'),
		size: integer('size'),
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
		index('post_like_user_created_idx').on(table.userId, table.createdAt),
	],
)

/** A repost puts someone else's post (or your own) on your timeline, once per person. */
export const repost = sqliteTable(
	'repost',
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
		index('repost_post_idx').on(table.postId),
		index('repost_user_created_idx').on(table.userId, table.createdAt),
	],
)

/** Posts saved for later. Private: only their owner ever reads them, and no count is shown. */
export const bookmark = sqliteTable(
	'bookmark',
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
		index('bookmark_user_created_idx').on(table.userId, table.createdAt),
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
		// Trending counts one week of tags; without this it reads every tag ever used.
		index('post_tag_created_idx').on(table.createdAt, table.tag),
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
			enum: [
				'follow',
				'like',
				'reply',
				'mention',
				'repost',
				'quote',
				'moderation',
				'follow_request',
				'group_add',
				'group_remove',
			],
		}).notNull(),
		// The liked or reposted post, or the reply, mention or quote itself. Null for a follow.
		postId: text('post_id').references(() => post.id, { onDelete: 'cascade' }),
		/** For `moderation`: what a moderator did, which says why. */
		actionId: text('action_id').references((): AnySQLiteColumn => moderationAction.id, {
			onDelete: 'cascade',
		}),
		/** For `group_add` and `group_remove`: the group chat the reader was put in or taken out of. */
		conversationId: text('conversation_id').references((): AnySQLiteColumn => conversation.id, {
			onDelete: 'cascade',
		}),
		/** The group's name at that moment; someone removed never learns what it is called later. */
		groupName: text('group_name'),
		readAt: integer('read_at', { mode: 'timestamp_ms' }),
		createdAt: created_at(),
	},
	(table) => [
		index('notification_user_created_idx').on(table.userId, table.createdAt),
		// The unread badge, asked on every page and every minute, reads only unread rows.
		index('notification_unread_idx')
			.on(table.userId)
			.where(sql`${table.readAt} is null`),
	],
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
	/** A group's photo: a `/media/messages/…` upload of one of its members. */
	image: text('image'),
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
		/** Only groups use it: one owner, who names admins; both can remove people. */
		role: text('role', { enum: ['owner', 'admin', 'member'] })
			.notNull()
			.default('member'),
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
		/**
		 * Set on the lines a group writes about itself ("Mika added Ken"), which nobody typed:
		 * `senderId` did it, to `targetId` where there is one. A rename keeps the new name in `body`.
		 */
		event: text('event', {
			enum: [
				'created',
				'added',
				'removed',
				'left',
				'admin_on',
				'admin_off',
				'owner',
				'renamed',
				'photo',
			],
		}),
		targetId: text('target_id').references(() => user.id, { onDelete: 'set null' }),
		mediaKind: text('media_kind', { enum: ['image', 'gif'] }),
		mediaUrl: text('media_url'),
		mediaWidth: integer('media_width'),
		mediaHeight: integer('media_height'),
		// Unused since file attachments were taken out; kept to match the database (migration 0010).
		mediaName: text('media_name'),
		mediaSize: integer('media_size'),
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

/**
 * An account's place in moderation: its role and any suspension. Only accounts with something to
 * record have a row; no row is a member in good standing. See docs/MODERATION.md.
 */
export const accountStanding = sqliteTable('account_standing', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	/** Set by `pnpm db:grant-moderator`, never by the app. Tied to the id, not the handle. */
	role: text('role', { enum: ['member', 'moderator'] })
		.notNull()
		.default('member'),
	/** When the current suspension began; null when the account isn't suspended. */
	suspendedAt: integer('suspended_at', { mode: 'timestamp_ms' }),
	/** When it ends; null with `suspendedAt` set is a permanent suspension. */
	suspendedUntil: integer('suspended_until', { mode: 'timestamp_ms' }),
	/** The rule broken, from `#lib/moderation/rules`. */
	suspendReason: text('suspend_reason'),
	/** The action that suspended it, which a review request is filed against. */
	suspendActionId: text('suspend_action_id'),
	/** Held to a new account's limits, by a moderator or a high behaviour score. */
	restricted: integer('restricted', { mode: 'boolean' }).notNull().default(false),
	/** Who restricted it; a moderator's restriction is only lifted by a moderator. */
	restrictedBy: text('restricted_by', { enum: ['moderator', 'score'] }),
	/** The last behaviour score, 0 to 100, from `server/moderation/score.ts`. */
	behaviourScore: integer('behaviour_score').notNull().default(0),
	scoredAt: integer('scored_at', { mode: 'timestamp_ms' }),
	updatedAt: written_at('updated_at'),
})

export const verifiedAccount = sqliteTable('verified_account', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	kind: text('kind', { enum: ['developer'] }).notNull(),
	grantedAt: written_at('granted_at'),
})

const target_kind = () => text('target_kind', { enum: ['post', 'profile', 'message'] }).notNull()

/**
 * Everything about one post, profile or message that needs a moderator: its reports and automatic
 * flags together, so ten reports are one item in the queue. Reopened by the next report.
 */
export const moderationCase = sqliteTable(
	'moderation_case',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		targetKind: target_kind(),
		targetId: text('target_id').notNull(),
		/** Whose content it is, so the queue can show their history. */
		targetUserId: text('target_user_id').references(() => user.id, { onDelete: 'cascade' }),
		status: text('status', { enum: ['open', 'actioned', 'dismissed'] })
			.notNull()
			.default('open'),
		/** Higher first in the queue. */
		priority: integer('priority').notNull().default(0),
		reports: integer('reports').notNull().default(0),
		/** The rule most reports or flags named. */
		reason: text('reason'),
		/** Results of automatic checks, as a JSON object keyed by check. */
		flags: text('flags').notNull().default('{}'),
		createdAt: created_at(),
		updatedAt: written_at('updated_at'),
		closedAt: integer('closed_at', { mode: 'timestamp_ms' }),
	},
	(table) => [
		uniqueIndex('moderation_case_target_idx').on(table.targetKind, table.targetId),
		index('moderation_case_queue_idx').on(table.status, table.priority, table.updatedAt),
	],
)

/** Every moderator decision, and every automatic one, in order. Rows are never edited but to reverse. */
export const moderationAction = sqliteTable(
	'moderation_action',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		caseId: text('case_id').references(() => moderationCase.id, { onDelete: 'set null' }),
		/** Null for an automatic action. */
		moderatorId: text('moderator_id').references(() => user.id, { onDelete: 'set null' }),
		action: text('action', {
			enum: [
				'dismiss',
				'warn',
				'sensitive',
				'limit',
				'remove',
				'restore',
				'suspend',
				'unsuspend',
				'block_domain',
				'block_media',
				'restrict',
				'unrestrict',
			],
		}).notNull(),
		reason: text('reason'),
		/** Whether this counts as a strike against `targetUserId`. */
		strike: integer('strike', { mode: 'boolean' }).notNull().default(false),
		targetKind: text('target_kind', {
			enum: ['post', 'profile', 'message', 'account', 'domain', 'media'],
		}).notNull(),
		targetId: text('target_id').notNull(),
		targetUserId: text('target_user_id').references(() => user.id, { onDelete: 'cascade' }),
		/** For a suspension, when it ends; null for permanent. */
		expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),
		/** The moderator's own words, shown to the person affected. */
		note: text('note'),
		createdAt: created_at(),
		reversedAt: integer('reversed_at', { mode: 'timestamp_ms' }),
	},
	(table) => [
		index('moderation_action_user_idx').on(table.targetUserId, table.createdAt),
		index('moderation_action_target_idx').on(table.targetKind, table.targetId),
	],
)

/** A request to undo an action: one per action, so a suspension is reviewed once. */
export const appeal = sqliteTable(
	'appeal',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		actionId: text('action_id')
			.notNull()
			.unique()
			.references(() => moderationAction.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		body: text('body').notNull(),
		status: text('status', { enum: ['open', 'upheld', 'refused'] })
			.notNull()
			.default('open'),
		decidedBy: text('decided_by').references(() => user.id, { onDelete: 'set null' }),
		decidedAt: integer('decided_at', { mode: 'timestamp_ms' }),
		createdAt: created_at(),
	},
	(table) => [index('appeal_status_idx').on(table.status, table.createdAt)],
)

/** Domains whose links are refused and no longer drawn as links. Covers their subdomains. */
export const blockedDomain = sqliteTable('blocked_domain', {
	domain: text('domain').primaryKey(),
	/** Null when a check added it. */
	addedBy: text('added_by').references(() => user.id, { onDelete: 'set null' }),
	reason: text('reason'),
	createdAt: created_at(),
})

/** SHA-256 of removed images, as stored after stripping, so the same file can't come back. */
export const blockedMediaHash = sqliteTable('blocked_media_hash', {
	sha256: text('sha256').primaryKey(),
	addedBy: text('added_by').references(() => user.id, { onDelete: 'set null' }),
	createdAt: created_at(),
})

/**
 * What the vision model said about a post photo while its post was being written, so the composer
 * can warn its author and publishing doesn't ask again. The scores are null when the image was
 * passed over by trust sampling; see `check_upload`.
 */
export const mediaCheck = sqliteTable('media_check', {
	url: text('url').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	nudity: integer('nudity'),
	violence: integer('violence'),
	gore: integer('gore'),
	createdAt: created_at(),
})

/**
 * A post's text translated into one language, so it's paid for once, not once per reader. Keyed by
 * post and language; `version` is the post's edit time when it was translated (0 if never
 * edited), and a newer edit overwrites the row instead of piling up old ones.
 */
export const postTranslation = sqliteTable(
	'post_translation',
	{
		postId: text('post_id')
			.notNull()
			.references(() => post.id, { onDelete: 'cascade' }),
		language: text('language').notNull(),
		version: integer('version').notNull(),
		text: text('text').notNull(),
		createdAt: created_at(),
	},
	(table) => [primaryKey({ columns: [table.postId, table.language] })],
)

/** Neurons the automatic checks spent each UTC day, by kind, against `server/moderation/budget.ts`. */
export const aiUsage = sqliteTable('ai_usage', {
	/** `YYYY-MM-DD`, UTC, as Workers AI counts its free allocation. */
	day: text('day').primaryKey(),
	text: integer('text').notNull().default(0),
	image: integer('image').notNull().default(0),
	report: integer('report').notNull().default(0),
	translate: integer('translate').notNull().default(0),
})

export * from './auth.schema'
