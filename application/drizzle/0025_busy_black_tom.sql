CREATE TABLE `task_progress_updates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` integer NOT NULL,
	`employee_email` text NOT NULL,
	`progress` integer NOT NULL,
	`output_realization` text DEFAULT '' NOT NULL,
	`completed_activities` text DEFAULT '' NOT NULL,
	`obstacles` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
