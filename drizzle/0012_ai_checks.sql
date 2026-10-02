CREATE TABLE `ai_usage` (
	`day` text PRIMARY KEY NOT NULL,
	`text` integer DEFAULT 0 NOT NULL,
	`image` integer DEFAULT 0 NOT NULL,
	`report` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE `post` ADD `checked` text DEFAULT 'skipped' NOT NULL;--> statement-breakpoint
CREATE INDEX `post_checked_idx` ON `post` (`checked`,`created_at`);