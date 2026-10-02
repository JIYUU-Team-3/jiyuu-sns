ALTER TABLE `notification` ADD `action_id` text REFERENCES moderation_action(id);--> statement-breakpoint
ALTER TABLE `post` ADD `moderation` text DEFAULT 'visible' NOT NULL;--> statement-breakpoint
ALTER TABLE `post` ADD `sensitive` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `post` ADD `removed_at` integer;