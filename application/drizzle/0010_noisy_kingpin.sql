CREATE TABLE `system_accounts` (
	`email` text PRIMARY KEY NOT NULL,
	`display_name` text DEFAULT 'Pemilik Sistem' NOT NULL,
	`role` text DEFAULT 'super_user' NOT NULL,
	`status` text DEFAULT 'Aktif' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_employees` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`full_name` text NOT NULL,
	`employee_number` text NOT NULL,
	`email` text,
	`phone` text NOT NULL,
	`position` text DEFAULT '' NOT NULL,
	`unit_subsection` text DEFAULT 'Sekretariat' NOT NULL,
	`direct_supervisor_id` integer,
	`employee_status` text DEFAULT 'Aktif' NOT NULL,
	`account_status` text DEFAULT 'Aktif' NOT NULL,
	`access_level` text DEFAULT 'User' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_employees`("id", "full_name", "employee_number", "email", "phone", "position", "unit_subsection", "direct_supervisor_id", "employee_status", "account_status", "access_level", "created_at", "updated_at") SELECT "id", "full_name", "employee_number", "email", "phone", "position", "unit_subsection", "direct_supervisor_id", "employee_status", "account_status", "access_level", "created_at", "updated_at" FROM `employees`;--> statement-breakpoint
DROP TABLE `employees`;--> statement-breakpoint
ALTER TABLE `__new_employees` RENAME TO `employees`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `employees_employee_number_unique` ON `employees` (`employee_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `employees_email_unique` ON `employees` (`email`);
--> statement-breakpoint
UPDATE `employees` SET `email` = NULL;
--> statement-breakpoint
INSERT OR IGNORE INTO `system_accounts` (`email`,`display_name`,`role`,`status`) VALUES ('kurzelaofficial@gmail.com','Kurzela Official','super_user','Aktif');
