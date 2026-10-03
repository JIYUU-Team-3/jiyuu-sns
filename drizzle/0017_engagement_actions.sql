CREATE TABLE `bookmark` (
	`user_id` text NOT NULL,
	`post_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`user_id`, `post_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`post_id`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `bookmark_user_created_idx` ON `bookmark` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `repost` (
	`user_id` text NOT NULL,
	`post_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`user_id`, `post_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`post_id`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `repost_post_idx` ON `repost` (`post_id`);--> statement-breakpoint
CREATE INDEX `repost_user_created_idx` ON `repost` (`user_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `post` ADD `quote_id` text;--> statement-breakpoint
CREATE INDEX `post_quote_idx` ON `post` (`quote_id`);--> statement-breakpoint
CREATE INDEX `post_like_user_created_idx` ON `post_like` (`user_id`,`created_at`);