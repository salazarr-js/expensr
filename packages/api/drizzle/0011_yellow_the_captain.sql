ALTER TABLE `records` ADD `split_type` text DEFAULT 'equal' NOT NULL;--> statement-breakpoint
-- Backfill: records with my_shares > 1 are weighted splits
UPDATE records SET split_type = 'weighted' WHERE my_shares > 1;