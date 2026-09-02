CREATE TABLE `activity_agendas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`start_time` text DEFAULT '' NOT NULL,
	`end_time` text DEFAULT '' NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`unit` text NOT NULL,
	`person_in_charge` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'Akan Berjalan' NOT NULL,
	`rescheduled_date` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE `attendance_reopen_requests` ADD `attendance_type` text DEFAULT 'Absen Masuk' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `created_by` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `approval_status` text DEFAULT 'Tidak Perlu Persetujuan' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `approval_requested_at` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `approval_decided_by` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `approval_decided_at` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `approval_note` text DEFAULT '' NOT NULL;