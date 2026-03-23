CREATE TABLE `record_people` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`record_id` integer NOT NULL,
	`person_id` integer NOT NULL,
	FOREIGN KEY (`record_id`) REFERENCES `records`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `record_people_unique` ON `record_people` (`record_id`,`person_id`);--> statement-breakpoint
CREATE INDEX `record_people_record_idx` ON `record_people` (`record_id`);--> statement-breakpoint
CREATE INDEX `record_people_person_idx` ON `record_people` (`person_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`amount` real NOT NULL,
	`date` text NOT NULL,
	`account_id` integer NOT NULL,
	`tag_id` integer,
	`category_id` integer,
	`linked_record_id` integer,
	`note` text,
	`needs_review` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_records`("id", "type", "amount", "date", "account_id", "tag_id", "category_id", "linked_record_id", "note", "needs_review", "created_at", "updated_at") SELECT "id", "type", "amount", "date", "account_id", "tag_id", "category_id", "linked_record_id", "note", "needs_review", "created_at", "updated_at" FROM `records`;--> statement-breakpoint
DROP TABLE `records`;--> statement-breakpoint
ALTER TABLE `__new_records` RENAME TO `records`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `records_account_id_idx` ON `records` (`account_id`);--> statement-breakpoint
CREATE INDEX `records_date_idx` ON `records` (`date`);--> statement-breakpoint
CREATE INDEX `records_category_id_idx` ON `records` (`category_id`);--> statement-breakpoint
CREATE INDEX `records_tag_id_idx` ON `records` (`tag_id`);