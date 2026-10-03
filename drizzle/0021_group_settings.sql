ALTER TABLE `conversation` ADD `image` text;--> statement-breakpoint
ALTER TABLE `conversation_member` ADD `role` text DEFAULT 'member' NOT NULL;--> statement-breakpoint
ALTER TABLE `message` ADD `event` text;--> statement-breakpoint
ALTER TABLE `message` ADD `target_id` text REFERENCES user(id) ON DELETE set null;--> statement-breakpoint
UPDATE `conversation_member` SET `role` = 'owner'
WHERE `user_id` = (
	SELECT c.`created_by` FROM `conversation` c
	WHERE c.`id` = `conversation_member`.`conversation_id` AND c.`is_group`
);--> statement-breakpoint
UPDATE `conversation_member` SET `role` = 'owner'
WHERE EXISTS (
		SELECT 1 FROM `conversation` c
		WHERE c.`id` = `conversation_member`.`conversation_id` AND c.`is_group`
	)
	AND NOT EXISTS (
		SELECT 1 FROM `conversation_member` o
		WHERE o.`conversation_id` = `conversation_member`.`conversation_id` AND o.`role` = 'owner'
	)
	AND `user_id` = (
		SELECT m.`user_id` FROM `conversation_member` m
		WHERE m.`conversation_id` = `conversation_member`.`conversation_id`
		ORDER BY m.`created_at`, m.`user_id` LIMIT 1
	);
