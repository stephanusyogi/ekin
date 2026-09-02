CREATE TABLE `attendances` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`employee_email` text NOT NULL,
	`work_date` text NOT NULL,
	`check_in` text NOT NULL,
	`check_out` text,
	`location` text DEFAULT 'Kantor Utama' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`email` text PRIMARY KEY NOT NULL,
	`full_name` text NOT NULL,
	`employee_number` text DEFAULT '' NOT NULL,
	`unit` text DEFAULT 'Subbag Umum' NOT NULL,
	`role` text DEFAULT 'user' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_email` text NOT NULL,
	`title` text NOT NULL,
	`unit` text DEFAULT 'Subbag Umum' NOT NULL,
	`due` text DEFAULT 'Belum ditentukan' NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'Baru' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
