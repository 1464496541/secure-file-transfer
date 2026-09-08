CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`actor_email` text NOT NULL,
	`action` text NOT NULL,
	`file_id` text,
	`detail` text NOT NULL,
	`success` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_audit_actor_created` ON `audit_logs` (`actor_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`owner_email` text NOT NULL,
	`original_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`r2_key` text NOT NULL,
	`iv` text NOT NULL,
	`wrapped_key` text NOT NULL,
	`sha256` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_files_owner_created` ON `files` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_files_r2_key` ON `files` (`r2_key`);--> statement-breakpoint
CREATE TABLE `shares` (
	`id` text PRIMARY KEY NOT NULL,
	`file_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`recipient_email` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	`download_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_shares_file_recipient` ON `shares` (`file_id`,`recipient_email`);--> statement-breakpoint
CREATE INDEX `idx_shares_recipient_expiry` ON `shares` (`recipient_email`,`expires_at`);