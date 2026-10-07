CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`display_name` text NOT NULL,
	`email` text,
	`role` text DEFAULT 'user' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`last_login_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_username` ON `users` (`username`);--> statement-breakpoint
CREATE INDEX `idx_users_email` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	`user_agent` text,
	`ip_address` text
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_user` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_sessions_expires` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `login_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`username` text NOT NULL,
	`login_time` text NOT NULL,
	`login_ip` text,
	`user_agent` text,
	`browser_name` text,
	`browser_version` text,
	`operating_system` text,
	`device_type` text,
	`login_status` text NOT NULL,
	`failure_reason` text,
	`session_id` text,
	`logout_time` text
);
--> statement-breakpoint
CREATE INDEX `idx_login_logs_time` ON `login_logs` (`login_time`);--> statement-breakpoint
CREATE INDEX `idx_login_logs_username_time` ON `login_logs` (`username`,`login_time`);--> statement-breakpoint
CREATE INDEX `idx_login_logs_ip_time` ON `login_logs` (`login_ip`,`login_time`);--> statement-breakpoint
CREATE INDEX `idx_login_logs_status_time` ON `login_logs` (`login_status`,`login_time`);
