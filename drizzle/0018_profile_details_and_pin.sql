ALTER TABLE `profile` ADD `location` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `profile` ADD `birth_date` text;--> statement-breakpoint
ALTER TABLE `profile` ADD `birthday_audience` text DEFAULT 'followers' NOT NULL;--> statement-breakpoint
ALTER TABLE `profile` ADD `birth_year_audience` text DEFAULT 'only_me' NOT NULL;--> statement-breakpoint
ALTER TABLE `profile` ADD `pinned_post_id` text REFERENCES post(id) ON DELETE set null;