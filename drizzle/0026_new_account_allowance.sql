CREATE TABLE `new_account_allowance` (
	`user_id` text NOT NULL,
	`day` text NOT NULL,
	`links` integer DEFAULT 0 NOT NULL,
	`videos` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`user_id`, `day`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
