ALTER TABLE `follow` ADD `notify_posts` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `follow_notify_idx` ON `follow` (`following_id`) WHERE "follow"."notify_posts" = 1;