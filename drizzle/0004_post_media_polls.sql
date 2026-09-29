CREATE TABLE `poll` (
	`post_id` text PRIMARY KEY NOT NULL,
	`ends_at` integer NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `poll_option` (
	`post_id` text NOT NULL,
	`position` integer NOT NULL,
	`label` text NOT NULL,
	PRIMARY KEY(`post_id`, `position`),
	FOREIGN KEY (`post_id`) REFERENCES `poll`(`post_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `poll_vote` (
	`post_id` text NOT NULL,
	`user_id` text NOT NULL,
	`position` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`post_id`, `user_id`),
	FOREIGN KEY (`post_id`) REFERENCES `poll`(`post_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `poll_vote_option_idx` ON `poll_vote` (`post_id`,`position`);--> statement-breakpoint
CREATE TABLE `post_media` (
	`post_id` text NOT NULL,
	`position` integer NOT NULL,
	`kind` text NOT NULL,
	`url` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	PRIMARY KEY(`post_id`, `position`),
	FOREIGN KEY (`post_id`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `post` ADD `location` text;