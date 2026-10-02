CREATE TABLE `media_check` (
	`url` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`nudity` integer,
	`violence` integer,
	`gore` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
