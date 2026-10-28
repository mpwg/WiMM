CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "account_archived" CHECK("accounts"."archived" IN (0, 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_workspace_id_id_unique` ON `accounts` (`workspace_id`,`id`);--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`account_id` text NOT NULL,
	`category_id` text,
	`date` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`description` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `identities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspace_id`,`account_id`) REFERENCES `accounts`(`workspace_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspace_id`,`category_id`) REFERENCES `categories`(`workspace_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "nonzero_amount" CHECK(typeof("bookings"."amount_cents") = 'integer' AND "bookings"."amount_cents" <> 0),
	CONSTRAINT "positive_version" CHECK("bookings"."version" >= 1)
);
--> statement-breakpoint
CREATE INDEX `bookings_workspace_date` ON `bookings` (`workspace_id`,`date`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_workspace_id_id_unique` ON `bookings` (`workspace_id`,`id`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "category_archived" CHECK("categories"."archived" IN (0, 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_workspace_id_id_unique` ON `categories` (`workspace_id`,`id`);--> statement-breakpoint
CREATE TABLE `identities` (
	`id` text PRIMARY KEY NOT NULL,
	`issuer` text NOT NULL,
	`subject` text NOT NULL,
	`display_name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `identities_issuer_subject_unique` ON `identities` (`issuer`,`subject`);--> statement-breakpoint
CREATE TABLE `imports` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`created_by` text NOT NULL,
	`account_id` text NOT NULL,
	`file_hash` text NOT NULL,
	`preview` text NOT NULL,
	`errors` text NOT NULL,
	`result` text,
	`status` text DEFAULT 'preview' NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `identities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspace_id`,`account_id`) REFERENCES `accounts`(`workspace_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "import_status" CHECK("imports"."status" IN ('preview', 'confirmed'))
);
--> statement-breakpoint
CREATE INDEX `imports_workspace_hash` ON `imports` (`workspace_id`,`account_id`,`file_hash`);--> statement-breakpoint
CREATE TABLE `receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`booking_id` text NOT NULL,
	`storage_key` text NOT NULL,
	`original_name` text NOT NULL,
	`media_type` text NOT NULL,
	`size` integer NOT NULL,
	`status` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspace_id`,`booking_id`) REFERENCES `bookings`(`workspace_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "receipt_status" CHECK("receipts"."status" IN ('pending', 'ready', 'deleting')),
	CONSTRAINT "receipt_size" CHECK("receipts"."size" > 0 AND "receipts"."size" <= 10485760),
	CONSTRAINT "receipt_media_type" CHECK("receipts"."media_type" IN ('application/pdf', 'image/jpeg', 'image/png'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `receipts_storage_key_unique` ON `receipts` (`storage_key`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`groups_checked_at` integer NOT NULL,
	`groups` text NOT NULL,
	`csrf_token` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `identities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	CONSTRAINT "currency_eur" CHECK("workspaces"."currency" = 'EUR')
);
