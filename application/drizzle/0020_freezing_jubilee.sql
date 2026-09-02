ALTER TABLE `annual_work_plans` ADD `document_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `annual_work_plans` ADD `rkt_type` text DEFAULT 'Ketua' NOT NULL;--> statement-breakpoint
ALTER TABLE `annual_work_plans` ADD `program_order` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `annual_work_plans` ADD `objective_order` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `annual_work_plans` ADD `indicator_order` integer DEFAULT 0 NOT NULL;