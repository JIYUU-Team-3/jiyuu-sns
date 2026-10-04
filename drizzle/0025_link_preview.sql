CREATE TABLE `link_preview` (
	`url` text PRIMARY KEY NOT NULL,
	`title` text,
	`description` text,
	`site_name` text,
	`image` text,
	`image_width` integer,
	`image_height` integer,
	`fetched_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `post` ADD `link_url` text;