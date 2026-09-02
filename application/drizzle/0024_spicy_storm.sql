CREATE TABLE `security_audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor_email` text DEFAULT 'anonymous' NOT NULL,
	`actor_role` text DEFAULT 'unknown' NOT NULL,
	`action` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'BERHASIL' NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`before_data` text DEFAULT '' NOT NULL,
	`after_data` text DEFAULT '' NOT NULL,
	`ip_address` text DEFAULT '' NOT NULL,
	`user_agent` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `security_backup_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`requested_by` text NOT NULL,
	`backup_type` text DEFAULT 'JSON_MANUAL' NOT NULL,
	`record_count` integer DEFAULT 0 NOT NULL,
	`status` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `security_rate_limits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`identity_key` text NOT NULL,
	`action` text NOT NULL,
	`window_start` text NOT NULL,
	`request_count` integer DEFAULT 1 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `security_rate_identity_action_unique` ON `security_rate_limits` (`identity_key`,`action`);