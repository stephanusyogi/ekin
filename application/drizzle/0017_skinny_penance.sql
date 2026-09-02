CREATE TABLE `action_plans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`rkt_id` integer NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`responsible_unit` text DEFAULT '' NOT NULL,
	`pic_employee_id` integer,
	`deadline` text DEFAULT '' NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`realization` text DEFAULT '' NOT NULL,
	`evidence` text DEFAULT '' NOT NULL,
	`validation_status` text DEFAULT 'Belum Diverifikasi' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `annual_work_plans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`year` integer NOT NULL,
	`scope` text DEFAULT 'Instansi' NOT NULL,
	`objective` text NOT NULL,
	`indicator` text NOT NULL,
	`target` text NOT NULL,
	`unit` text DEFAULT 'Persen' NOT NULL,
	`policy_owner_id` integer,
	`notes` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'Draft' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE `performance_agreements` ADD `agreement_level` text DEFAULT 'Staf' NOT NULL;--> statement-breakpoint
ALTER TABLE `performance_agreements` ADD `source_type` text DEFAULT 'TUSI Kesekretariatan' NOT NULL;--> statement-breakpoint
ALTER TABLE `performance_agreements` ADD `source_rkt_id` integer;--> statement-breakpoint
ALTER TABLE `performance_agreements` ADD `source_action_plan_id` integer;--> statement-breakpoint
ALTER TABLE `performance_agreements` ADD `parent_agreement_id` integer;--> statement-breakpoint
ALTER TABLE `performance_agreements` ADD `coordination_commissioner_id` integer;--> statement-breakpoint
ALTER TABLE `performance_agreements` ADD `source_description` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `performance_agreements` ADD `revision_notes` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `performance_agreements` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `performance_indicators` ADD `progress` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `performance_indicators` ADD `evidence` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `performance_indicators` ADD `validation_status` text DEFAULT 'Belum Diverifikasi' NOT NULL;--> statement-breakpoint
ALTER TABLE `performance_indicators` ADD `validated_by` text;--> statement-breakpoint
ALTER TABLE `performance_indicators` ADD `validated_at` text;