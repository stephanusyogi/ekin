ALTER TABLE `attendance_settings` ADD `check_in_window_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `attendance_settings` ADD `check_in_open_time` text DEFAULT '05:00' NOT NULL;--> statement-breakpoint
ALTER TABLE `attendance_settings` ADD `check_in_close_time` text DEFAULT '08:30' NOT NULL;--> statement-breakpoint
ALTER TABLE `attendance_settings` ADD `check_out_window_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `attendance_settings` ADD `monday_thursday_check_out_open` text DEFAULT '16:00' NOT NULL;--> statement-breakpoint
ALTER TABLE `attendance_settings` ADD `friday_check_out_open` text DEFAULT '16:30' NOT NULL;--> statement-breakpoint
ALTER TABLE `attendance_settings` ADD `check_out_close_time` text DEFAULT '23:59' NOT NULL;