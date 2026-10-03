ALTER TABLE `notification` ADD `conversation_id` text REFERENCES conversation(id) ON DELETE cascade;--> statement-breakpoint
ALTER TABLE `notification` ADD `group_name` text;