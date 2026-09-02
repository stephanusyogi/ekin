CREATE TABLE `performance_agreements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`employee_id` integer NOT NULL,
	`supervisor_id` integer,
	`year` integer NOT NULL,
	`title` text DEFAULT 'Perjanjian Kinerja Tahunan' NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'Draft' NOT NULL,
	`created_by` text NOT NULL,
	`approved_by` text,
	`approved_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `performance_indicators` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`agreement_id` integer NOT NULL,
	`objective` text NOT NULL,
	`indicator` text NOT NULL,
	`target` text NOT NULL,
	`unit` text DEFAULT 'Dokumen' NOT NULL,
	`realization` text DEFAULT '' NOT NULL,
	`achievement` integer DEFAULT 0 NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
