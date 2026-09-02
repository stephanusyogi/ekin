PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_attendance_settings` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`monday_thursday_start` text DEFAULT '07:30' NOT NULL,
	`monday_thursday_end` text DEFAULT '16:00' NOT NULL,
	`friday_start` text DEFAULT '07:30' NOT NULL,
	`friday_end` text DEFAULT '16:30' NOT NULL,
	`grace_minutes` integer DEFAULT 0 NOT NULL,
	`replacement_multiplier` integer DEFAULT 1 NOT NULL,
	`morning_cutoff` text DEFAULT '08:30' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_attendance_settings`("id", "monday_thursday_start", "monday_thursday_end", "friday_start", "friday_end", "grace_minutes", "replacement_multiplier", "morning_cutoff", "updated_at") SELECT "id", "monday_thursday_start", "monday_thursday_end", "friday_start", "friday_end", "grace_minutes", "replacement_multiplier", "morning_cutoff", "updated_at" FROM `attendance_settings`;--> statement-breakpoint
DROP TABLE `attendance_settings`;--> statement-breakpoint
ALTER TABLE `__new_attendance_settings` RENAME TO `attendance_settings`;--> statement-breakpoint
UPDATE `attendance_settings` SET `grace_minutes` = 0, `replacement_multiplier` = 1, `morning_cutoff` = '08:30', `updated_at` = CURRENT_TIMESTAMP;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `attendances` ADD `work_output` text DEFAULT '' NOT NULL;
