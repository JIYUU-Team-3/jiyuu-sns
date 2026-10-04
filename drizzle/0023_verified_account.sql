CREATE TABLE `verified_account` (
	`user_id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`granted_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
