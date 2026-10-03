ALTER TABLE `message` ADD `event` text;--> statement-breakpoint
ALTER TABLE `message` ADD `target_id` text REFERENCES user(id) ON DELETE set null;