CREATE TABLE `organization_coordinations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`commissioner_employee_id` integer NOT NULL,
	`unit_subsection` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `coordination_commissioner_unit_unique` ON `organization_coordinations` (`commissioner_employee_id`,`unit_subsection`);--> statement-breakpoint
ALTER TABLE `tasks` ADD `pic_emails` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `priority` text DEFAULT 'Sedang' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `deadline` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `extended_deadline` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `output` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `notes` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `verification_status` text DEFAULT 'Belum Diverifikasi' NOT NULL;