ALTER TABLE `employees` RENAME COLUMN "employee_type" TO "unit_subsection";--> statement-breakpoint
ALTER TABLE `employees` ADD `direct_supervisor_id` integer;--> statement-breakpoint
ALTER TABLE `employees` ADD `employee_status` text DEFAULT 'Aktif' NOT NULL;--> statement-breakpoint
ALTER TABLE `employees` ADD `account_status` text DEFAULT 'Aktif' NOT NULL;