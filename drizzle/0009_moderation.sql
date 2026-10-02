CREATE TABLE `account_standing` (
	`user_id` text PRIMARY KEY NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`suspended_at` integer,
	`suspended_until` integer,
	`suspend_reason` text,
	`suspend_action_id` text,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `appeal` (
	`id` text PRIMARY KEY NOT NULL,
	`action_id` text NOT NULL,
	`user_id` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`decided_by` text,
	`decided_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`action_id`) REFERENCES `moderation_action`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`decided_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `appeal_action_id_unique` ON `appeal` (`action_id`);--> statement-breakpoint
CREATE INDEX `appeal_status_idx` ON `appeal` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `moderation_action` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text,
	`moderator_id` text,
	`action` text NOT NULL,
	`reason` text,
	`strike` integer DEFAULT false NOT NULL,
	`target_kind` text NOT NULL,
	`target_id` text NOT NULL,
	`target_user_id` text,
	`expires_at` integer,
	`note` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`reversed_at` integer,
	FOREIGN KEY (`case_id`) REFERENCES `moderation_case`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`moderator_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`target_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `moderation_action_user_idx` ON `moderation_action` (`target_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `moderation_action_target_idx` ON `moderation_action` (`target_kind`,`target_id`);--> statement-breakpoint
CREATE TABLE `moderation_case` (
	`id` text PRIMARY KEY NOT NULL,
	`target_kind` text NOT NULL,
	`target_id` text NOT NULL,
	`target_user_id` text,
	`status` text DEFAULT 'open' NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`reports` integer DEFAULT 0 NOT NULL,
	`reason` text,
	`flags` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`closed_at` integer,
	FOREIGN KEY (`target_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `moderation_case_target_idx` ON `moderation_case` (`target_kind`,`target_id`);--> statement-breakpoint
CREATE INDEX `moderation_case_queue_idx` ON `moderation_case` (`status`,`priority`,`updated_at`);