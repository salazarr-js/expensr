ALTER TABLE `accounts` ADD `aliases` text;--> statement-breakpoint
ALTER TABLE `accounts` ADD `is_default` integer DEFAULT false NOT NULL;