CREATE TABLE `attendance_settings` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`monday_thursday_start` text DEFAULT '07:30' NOT NULL,
	`monday_thursday_end` text DEFAULT '16:00' NOT NULL,
	`friday_start` text DEFAULT '07:30' NOT NULL,
	`friday_end` text DEFAULT '16:30' NOT NULL,
	`grace_minutes` integer DEFAULT 0 NOT NULL,
	`replacement_multiplier` integer DEFAULT 2 NOT NULL,
	`morning_cutoff` text DEFAULT '09:00' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `holidays` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`holiday_date` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `holidays_holiday_date_unique` ON `holidays` (`holiday_date`);--> statement-breakpoint
ALTER TABLE `attendances` ADD `attendance_status` text DEFAULT 'on_time' NOT NULL;--> statement-breakpoint
ALTER TABLE `attendances` ADD `late_minutes` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `attendances` ADD `replacement_minutes` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `attendances` ADD `morning_session` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `attendances` ADD `is_holiday` integer DEFAULT false NOT NULL;