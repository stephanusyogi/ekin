CREATE TABLE `performance_budgets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`agreement_id` integer NOT NULL,
	`program_name` text NOT NULL,
	`output_description` text DEFAULT '' NOT NULL,
	`amount` integer DEFAULT 0 NOT NULL,
	`allocation_level` text DEFAULT 'Program' NOT NULL,
	`confirmation_status` text DEFAULT 'Tidak Perlu' NOT NULL,
	`confirmed_by` text,
	`confirmed_at` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
