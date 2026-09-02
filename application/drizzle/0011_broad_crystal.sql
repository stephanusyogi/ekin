CREATE TABLE `organization_units` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'Unit' NOT NULL,
	`parent_id` integer,
	`leader_employee_id` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'Aktif' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `organization_units` (`id`,`name`,`type`,`parent_id`,`sort_order`,`status`) VALUES
(1,'Lembaga','Lembaga',NULL,1,'Aktif'),
(2,'Komisioner','Komisioner',1,1,'Aktif'),
(3,'Sekretariat','Sekretariat',1,2,'Aktif');
