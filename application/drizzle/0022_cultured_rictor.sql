CREATE TABLE `performance_evaluations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`agreement_id` integer NOT NULL,
	`indicator_id` integer NOT NULL,
	`period_type` text NOT NULL,
	`period_key` text NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`budget_realization` integer DEFAULT 0 NOT NULL,
	`output_realization` text DEFAULT '' NOT NULL,
	`problem_identification` text DEFAULT '' NOT NULL,
	`improvement_effort` text DEFAULT '' NOT NULL,
	`completed_activities` text DEFAULT '' NOT NULL,
	`evidence_links` text DEFAULT '[]' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `evaluation_indicator_period_unique` ON `performance_evaluations` (`indicator_id`,`period_type`,`period_key`);