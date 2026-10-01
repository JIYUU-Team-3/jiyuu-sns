ALTER TABLE `account_standing` ADD `restricted_by` text;--> statement-breakpoint
ALTER TABLE `account_standing` ADD `behaviour_score` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `account_standing` ADD `scored_at` integer;