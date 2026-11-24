ALTER TABLE `bookings` ADD COLUMN `deleting` integer NOT NULL DEFAULT 0 CONSTRAINT `booking_deleting` CHECK (`deleting` IN (0, 1));--> statement-breakpoint
CREATE INDEX `imports_preview_expiry` ON `imports` (`expires_at`) WHERE `status` = 'preview';--> statement-breakpoint
CREATE INDEX `receipts_workspace_booking` ON `receipts` (`workspace_id`, `booking_id`);
