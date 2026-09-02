CREATE TABLE `demo_bootstrap_state` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`version` text NOT NULL,
	`applied_by` text NOT NULL,
	`applied_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `organization_positions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`level` text NOT NULL,
	`unit_id` integer NOT NULL,
	`reports_to_position_id` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'Aktif' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE `employees` ADD `organization_position_id` integer;--> statement-breakpoint
ALTER TABLE `employees` ADD `operator_attendance` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `employees` ADD `operator_sakip` integer DEFAULT false NOT NULL;