PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_employees` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`full_name` text NOT NULL,
	`employee_number` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`employee_type` text DEFAULT 'Sekretariat' NOT NULL,
	`position` text DEFAULT '' NOT NULL,
	`access_level` text DEFAULT 'User' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_employees`("id", "full_name", "employee_number", "email", "phone", "employee_type", "position", "access_level", "created_at", "updated_at") SELECT "id", "full_name", "employee_number", "email", "phone", 'Sekretariat', "position", 'User', "created_at", "updated_at" FROM `employees`;--> statement-breakpoint
DROP TABLE `employees`;--> statement-breakpoint
ALTER TABLE `__new_employees` RENAME TO `employees`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `employees_employee_number_unique` ON `employees` (`employee_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `employees_email_unique` ON `employees` (`email`);
--> statement-breakpoint
INSERT OR IGNORE INTO `employees` (`full_name`,`employee_number`,`email`,`phone`,`employee_type`,`position`,`access_level`) VALUES
('Andi Pratama','198501152010011001','andi.pratama@example.com','081234560001','Komisioner','Ketua','User'),
('Budi Santoso','198702202011011002','budi.santoso@example.com','081234560002','Komisioner','Anggota','User'),
('Citra Lestari','198903122012022003','citra.lestari@example.com','081234560003','Komisioner','Anggota','User'),
('Dedi Kurniawan','199001252013031004','dedi.kurniawan@example.com','081234560004','Komisioner','Anggota','User'),
('Budi Rahayu','199104182014042005','eka.maharani@example.com','081234560005','Sekretariat','Sekretaris','Admin'),
('Mohammad Noor Jihan','199205062015051006','fajar.hidayat@example.com','081234560006','Sekretariat','Kasubag Rendatin','Super Admin'),
('Gandha WP','199306142016062007','gita.permatasari@example.com','081234560007','Sekretariat','Kasubag SDM Parmas','Editor'),
('Nurfanty','199407212017071008','hendra.wijaya@example.com','081234560008','Sekretariat','Kasubag KUL','Editor'),
('Dwi Ardiani','199508092018082009','indah.sari@example.com','081234560009','Sekretariat','Kasubag Tekhum','Editor'),
('Joko Susanto','199609172019091010','joko.susanto@example.com','081234560010','Sekretariat','','User'),
('Kartika Dewi','199701282020101011','kartika.dewi@example.com','081234560011','Sekretariat','','User'),
('Lukman Hakim','199802112021111012','lukman.hakim@example.com','081234560012','Sekretariat','','User'),
('Maya Anggraini','199903192022122013','maya.anggraini@example.com','081234560013','Sekretariat','','User'),
('Nanda Saputra','200004252023011014','nanda.saputra@example.com','081234560014','Sekretariat','','User'),
('Oki Setiawan','200105162023021015','oki.setiawan@example.com','081234560015','Sekretariat','','User'),
('Putri Amelia','200206082023031016','putri.amelia@example.com','081234560016','Sekretariat','','User'),
('Rizky Ramadhan','200307172023041017','rizky.ramadhan@example.com','081234560017','Sekretariat','','User'),
('Sari Wulandari','200408292023051018','sari.wulandari@example.com','081234560018','Sekretariat','','User'),
('Taufik Hidayat','200509132023061019','taufik.hidayat@example.com','081234560019','Sekretariat','','User'),
('Umi Kalsum','200610242023071020','umi.kalsum@example.com','081234560020','Sekretariat','','User'),
('Vina Oktaviani','200711052023081021','vina.oktaviani@example.com','081234560021','Sekretariat','','User'),
('Wahyu Nugroho','200812162023091022','wahyu.nugroho@example.com','081234560022','Sekretariat','','User'),
('Yuni Astuti','200901272023101023','yuni.astuti@example.com','081234560023','Sekretariat','','User'),
('Zaki Firmansyah','199012182014111024','zaki.firmansyah@example.com','081234560024','Sekretariat','','User'),
('Ayu Rahmawati','199103292015121025','ayu.rahmawati@example.com','081234560025','Sekretariat','','User'),
('Bagus Maulana','199204112016011026','bagus.maulana@example.com','081234560026','Sekretariat','','User'),
('Dian Puspitasari','199305222017021027','dian.puspitasari@example.com','081234560027','Sekretariat','','User'),
('Eko Prasetyo','199406032018031028','eko.prasetyo@example.com','081234560028','Sekretariat','','User'),
('Fitri Handayani','199507142019041029','fitri.handayani@example.com','081234560029','Sekretariat','','User'),
('Galih Ramadhan','199608252020051030','galih.ramadhan@example.com','081234560030','Sekretariat','','User'),
('Hani Kusuma','199709162021061031','hani.kusuma@example.com','081234560031','Sekretariat','','User'),
('Irfan Maulana','199810272022071032','irfan.maulana@example.com','081234560032','Sekretariat','','User'),
('Jihan Safitri','199911082023081033','jihan.safitri@example.com','081234560033','Sekretariat','','User'),
('Kevin Aditya','200012192023091034','kevin.aditya@example.com','081234560034','Sekretariat','','User'),
('Lina Marlina','200101302023101035','lina.marlina@example.com','081234560035','Sekretariat','','User');
