CREATE TABLE `parse_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`input_text` text NOT NULL,
	`resolved_by` text NOT NULL,
	`tag_matched` integer NOT NULL,
	`account_matched` integer NOT NULL,
	`people_count` integer DEFAULT 0 NOT NULL,
	`ai_called` integer DEFAULT false NOT NULL,
	`ai_succeeded` integer,
	`was_corrected` integer,
	`parse_result` text NOT NULL,
	`final_result` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
DROP TABLE `parse_corrections`;