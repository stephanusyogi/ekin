ALTER TABLE `recurring_task_templates` ADD `source_performance_agreement_id` integer;--> statement-breakpoint
ALTER TABLE `recurring_task_templates` ADD `source_performance_indicator_id` integer;--> statement-breakpoint
ALTER TABLE `tasks` ADD `source_performance_agreement_id` integer;--> statement-breakpoint
ALTER TABLE `tasks` ADD `source_performance_indicator_id` integer;