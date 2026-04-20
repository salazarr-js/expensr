CREATE TABLE `draft_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date_time` text NOT NULL,
	`text` text NOT NULL,
	`amount` real,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
