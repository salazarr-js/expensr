CREATE TABLE `account_balances` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer NOT NULL,
	`year_month` text NOT NULL,
	`balance` real NOT NULL,
	`balance_date` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_balances_account_month_idx` ON `account_balances` (`account_id`,`year_month`);--> statement-breakpoint
ALTER TABLE `accounts` DROP COLUMN `starting_balance`;--> statement-breakpoint
ALTER TABLE `accounts` DROP COLUMN `real_balance`;--> statement-breakpoint
ALTER TABLE `accounts` DROP COLUMN `real_balance_date`;