-- Khaime's durable transaction id from Create Charge (`transaction_id`), so the
-- reconcile Cron can look a pending tip up with GET /transactions/:id when its
-- webhook never arrives. Null for tips created before this column existed.
ALTER TABLE `supports` ADD COLUMN `khaime_transaction_id` varchar(255) null;
CREATE INDEX `supports_status_created_at_index` on `supports` (`status`, `created_at`);
