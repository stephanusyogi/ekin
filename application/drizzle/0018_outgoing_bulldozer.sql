ALTER TABLE `annual_work_plans` ADD `program_activity` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `annual_work_plans` ADD `strategic_objective` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `performance_indicators` ADD `objective_type` text DEFAULT 'Sasaran Kegiatan' NOT NULL;--> statement-breakpoint
ALTER TABLE `performance_indicators` ADD `target_display` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `performance_indicators` ADD `source_rkt_id` integer;--> statement-breakpoint
ALTER TABLE `performance_indicators` ADD `source_mapping` text DEFAULT '{}' NOT NULL;