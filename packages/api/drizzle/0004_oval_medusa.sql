CREATE TABLE `parse_corrections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`prompt_text` text NOT NULL,
	`ai_response` text NOT NULL,
	`final_response` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
