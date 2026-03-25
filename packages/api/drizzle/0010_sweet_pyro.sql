ALTER TABLE `record_people` ADD `share_amount` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `records` ADD `my_shares` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
-- Backfill share_amount for existing shared records (equal split: amount / (people_count + 1))
UPDATE record_people SET share_amount = (
  SELECT r.amount / (
    (SELECT COUNT(*) FROM record_people rp2 WHERE rp2.record_id = record_people.record_id) + 1
  )
  FROM records r WHERE r.id = record_people.record_id
) WHERE EXISTS (SELECT 1 FROM records r WHERE r.id = record_people.record_id);