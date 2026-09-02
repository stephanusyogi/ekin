CREATE TABLE `attendance_audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`employee_email` text NOT NULL,
	`action` text NOT NULL,
	`work_date` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`actor_email` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `attendance_reopen_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`employee_email` text NOT NULL,
	`work_date` text NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'Menunggu' NOT NULL,
	`decided_by` text,
	`decided_at` text,
	`open_until` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `other_attendances` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`employee_email` text NOT NULL,
	`type` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`duration_days` integer NOT NULL,
	`destination` text DEFAULT '' NOT NULL,
	`purpose` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE `attendance_settings` ADD `daily_close_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `attendance_settings` ADD `daily_close_time` text DEFAULT '18:00' NOT NULL;