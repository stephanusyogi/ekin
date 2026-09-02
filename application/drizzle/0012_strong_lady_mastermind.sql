CREATE TABLE `recurring_task_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`unit` text NOT NULL,
	`pic_emails` text DEFAULT '[]' NOT NULL,
	`priority` text DEFAULT 'Sedang' NOT NULL,
	`frequency` text NOT NULL,
	`generation_day` integer DEFAULT 1 NOT NULL,
	`due_offset_days` integer DEFAULT 7 NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text DEFAULT '' NOT NULL,
	`verifier_email` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'Aktif' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE `tasks` ADD `recurring_template_id` integer;--> statement-breakpoint
ALTER TABLE `tasks` ADD `recurring_period_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `task_recurring_period_unique` ON `tasks` (`recurring_template_id`,`recurring_period_key`);