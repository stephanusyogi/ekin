ALTER TABLE `recurring_task_templates` ADD `output_type` text DEFAULT 'Dokumen' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `output_type` text DEFAULT 'Dokumen' NOT NULL;