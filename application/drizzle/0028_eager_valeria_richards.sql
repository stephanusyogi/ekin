ALTER TABLE `attendance_reopen_requests` ADD `statement_file_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `attendance_reopen_requests` ADD `statement_file_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `attendance_reopen_requests` ADD `statement_file_type` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `attendance_reopen_requests` ADD `statement_file_size` integer DEFAULT 0 NOT NULL;