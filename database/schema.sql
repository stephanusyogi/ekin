-- e-Kinerja Versi 55 - Schema MySQL 8.0 / MariaDB 10.6+
-- Import melalui phpMyAdmin pada database kosong.
-- Struktur + snapshot seluruh data existing database aktif Versi 55.
-- Snapshot diambil pada 2026-09-01 dan berisi 64 baris dari 28 tabel.
SET NAMES utf8mb4;
SET time_zone = '+07:00';
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE profiles (
  email VARCHAR(255) PRIMARY KEY, full_name VARCHAR(255) NOT NULL,
  employee_number VARCHAR(100) NOT NULL DEFAULT '', unit VARCHAR(255) NOT NULL DEFAULT 'Subbag Umum',
  role VARCHAR(30) NOT NULL DEFAULT 'user'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE system_accounts (
  email VARCHAR(255) PRIMARY KEY, display_name VARCHAR(255) NOT NULL DEFAULT 'Pemilik Sistem',
  role VARCHAR(30) NOT NULL DEFAULT 'super_user', status VARCHAR(30) NOT NULL DEFAULT 'Aktif',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE organization_units (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL DEFAULT 'Unit', parent_id BIGINT UNSIGNED NULL,
  leader_employee_id BIGINT UNSIGNED NULL, sort_order INT NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'Aktif', created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_org_parent (parent_id), INDEX idx_org_leader (leader_employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE organization_positions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) NOT NULL,
  level VARCHAR(30) NOT NULL, unit_id BIGINT UNSIGNED NOT NULL,
  reports_to_position_id BIGINT UNSIGNED NULL, sort_order INT NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'Aktif', created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_position_unit (unit_id), INDEX idx_position_supervisor (reports_to_position_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE employees (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, full_name VARCHAR(255) NOT NULL,
  employee_number VARCHAR(100) NOT NULL UNIQUE, email VARCHAR(255) NULL UNIQUE,
  phone VARCHAR(100) NOT NULL, position VARCHAR(255) NOT NULL DEFAULT '',
  unit_subsection VARCHAR(255) NOT NULL DEFAULT 'Sekretariat', direct_supervisor_id BIGINT UNSIGNED NULL,
  organization_position_id BIGINT UNSIGNED NULL, operator_attendance TINYINT(1) NOT NULL DEFAULT 0,
  operator_sakip TINYINT(1) NOT NULL DEFAULT 0, employee_status VARCHAR(30) NOT NULL DEFAULT 'Aktif',
  account_status VARCHAR(30) NOT NULL DEFAULT 'Dinonaktifkan', access_level VARCHAR(30) NOT NULL DEFAULT 'User',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_employee_supervisor (direct_supervisor_id), INDEX idx_employee_org_position (organization_position_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE organization_coordinations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, commissioner_employee_id BIGINT UNSIGNED NOT NULL,
  unit_subsection VARCHAR(255) NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY coordination_commissioner_unit_unique (commissioner_employee_id, unit_subsection)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE demo_bootstrap_state (
  id INT PRIMARY KEY DEFAULT 1, version VARCHAR(255) NOT NULL, applied_by VARCHAR(255) NOT NULL,
  applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE attendance_settings (
  id INT PRIMARY KEY DEFAULT 1, monday_thursday_start VARCHAR(5) NOT NULL DEFAULT '07:30',
  monday_thursday_end VARCHAR(5) NOT NULL DEFAULT '16:00', friday_start VARCHAR(5) NOT NULL DEFAULT '07:30',
  friday_end VARCHAR(5) NOT NULL DEFAULT '16:30', grace_minutes INT NOT NULL DEFAULT 0,
  replacement_multiplier INT NOT NULL DEFAULT 1, morning_cutoff VARCHAR(5) NOT NULL DEFAULT '08:30',
  daily_close_enabled TINYINT(1) NOT NULL DEFAULT 0, daily_close_time VARCHAR(5) NOT NULL DEFAULT '18:00',
  check_in_window_enabled TINYINT(1) NOT NULL DEFAULT 0, check_in_open_time VARCHAR(5) NOT NULL DEFAULT '05:00',
  check_in_close_time VARCHAR(5) NOT NULL DEFAULT '08:30', check_out_window_enabled TINYINT(1) NOT NULL DEFAULT 0,
  monday_thursday_check_out_open VARCHAR(5) NOT NULL DEFAULT '16:00', friday_check_out_open VARCHAR(5) NOT NULL DEFAULT '16:30',
  check_out_close_time VARCHAR(5) NOT NULL DEFAULT '23:59', print_header LONGTEXT NOT NULL,
  print_place VARCHAR(255) NOT NULL DEFAULT '', updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE holidays (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, holiday_date DATE NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL, description LONGTEXT NOT NULL, created_by VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE attendances (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, employee_email VARCHAR(255) NOT NULL,
  work_date DATE NOT NULL, check_in DATETIME NOT NULL, check_out DATETIME NULL,
  work_output LONGTEXT NOT NULL, location VARCHAR(255) NOT NULL DEFAULT 'Kantor Utama',
  attendance_status VARCHAR(50) NOT NULL DEFAULT 'on_time', late_minutes INT NOT NULL DEFAULT 0,
  replacement_minutes INT NOT NULL DEFAULT 0, morning_session TINYINT(1) NOT NULL DEFAULT 1,
  is_holiday TINYINT(1) NOT NULL DEFAULT 0, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY attendance_employee_date_unique (employee_email, work_date), INDEX idx_attendance_date (work_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE other_attendances (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, employee_email VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL, start_date DATE NOT NULL, end_date DATE NOT NULL,
  duration_days INT NOT NULL, document_number VARCHAR(255) NOT NULL DEFAULT '',
  document_date DATE NULL, leave_type VARCHAR(100) NOT NULL DEFAULT '', destination LONGTEXT NOT NULL,
  purpose LONGTEXT NOT NULL, notes LONGTEXT NOT NULL, created_by VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX idx_other_employee_dates (employee_email, start_date, end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE attendance_reopen_requests (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, employee_email VARCHAR(255) NOT NULL,
  work_date DATE NOT NULL, attendance_type VARCHAR(30) NOT NULL DEFAULT 'Absen Masuk', reason LONGTEXT NOT NULL,
  statement_file_key VARCHAR(500) NOT NULL DEFAULT '', statement_file_name VARCHAR(500) NOT NULL DEFAULT '',
  statement_file_type VARCHAR(150) NOT NULL DEFAULT '', statement_file_size BIGINT NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'Menunggu', decided_by VARCHAR(255) NULL,
  decided_at DATETIME NULL, open_until DATETIME NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_reopen_employee_date (employee_email, work_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE attendance_audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, employee_email VARCHAR(255) NOT NULL,
  action VARCHAR(100) NOT NULL, work_date DATE NOT NULL, detail LONGTEXT NOT NULL,
  actor_email VARCHAR(255) NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_employee_date (employee_email, work_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE activity_agendas (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, title VARCHAR(500) NOT NULL,
  start_date DATE NOT NULL, end_date DATE NOT NULL, start_time VARCHAR(5) NOT NULL DEFAULT '',
  end_time VARCHAR(5) NOT NULL DEFAULT '', location VARCHAR(500) NOT NULL DEFAULT '',
  unit VARCHAR(255) NOT NULL, person_in_charge VARCHAR(500) NOT NULL DEFAULT '',
  description LONGTEXT NOT NULL, status VARCHAR(50) NOT NULL DEFAULT 'Akan Berjalan',
  rescheduled_date DATE NULL, notes LONGTEXT NOT NULL, created_by VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_agenda_date (start_date), INDEX idx_agenda_unit (unit)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE recurring_task_templates (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, title VARCHAR(500) NOT NULL,
  description LONGTEXT NOT NULL, unit VARCHAR(255) NOT NULL, pic_emails JSON NOT NULL,
  priority VARCHAR(30) NOT NULL DEFAULT 'Sedang', output_type VARCHAR(50) NOT NULL DEFAULT 'Dokumen',
  source_performance_agreement_id BIGINT UNSIGNED NULL, source_performance_indicator_id BIGINT UNSIGNED NULL,
  frequency VARCHAR(30) NOT NULL, generation_day INT NOT NULL DEFAULT 1, due_offset_days INT NOT NULL DEFAULT 7,
  start_date DATE NOT NULL, end_date DATE NULL, verifier_email VARCHAR(255) NOT NULL DEFAULT '',
  notes LONGTEXT NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'Aktif', created_by VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tasks (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, owner_email VARCHAR(255) NOT NULL,
  title VARCHAR(500) NOT NULL, unit VARCHAR(255) NOT NULL DEFAULT 'Subbag Umum',
  due VARCHAR(255) NOT NULL DEFAULT 'Belum ditentukan', progress INT NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'Baru', pic_emails JSON NOT NULL,
  priority VARCHAR(30) NOT NULL DEFAULT 'Sedang', output_type VARCHAR(50) NOT NULL DEFAULT 'Dokumen',
  source_performance_agreement_id BIGINT UNSIGNED NULL, source_performance_indicator_id BIGINT UNSIGNED NULL,
  created_by VARCHAR(255) NOT NULL DEFAULT '', approval_status VARCHAR(50) NOT NULL DEFAULT 'Tidak Perlu Persetujuan',
  approval_requested_at DATETIME NULL, approval_decided_by VARCHAR(255) NULL, approval_decided_at DATETIME NULL,
  approval_note LONGTEXT NOT NULL, deadline DATE NULL, extended_deadline DATE NULL,
  output LONGTEXT NOT NULL, notes LONGTEXT NOT NULL,
  verification_status VARCHAR(50) NOT NULL DEFAULT 'Belum Diverifikasi',
  recurring_template_id BIGINT UNSIGNED NULL, recurring_period_key VARCHAR(100) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY task_recurring_period_unique (recurring_template_id, recurring_period_key),
  INDEX idx_task_owner (owner_email), INDEX idx_task_status (status), INDEX idx_task_source_pk (source_performance_agreement_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE task_progress_updates (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, task_id BIGINT UNSIGNED NOT NULL,
  employee_email VARCHAR(255) NOT NULL, progress INT NOT NULL, output_realization LONGTEXT NOT NULL,
  completed_activities LONGTEXT NOT NULL, obstacles LONGTEXT NOT NULL, notes LONGTEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX idx_task_progress_task (task_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE annual_work_plans (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, document_key VARCHAR(255) NOT NULL DEFAULT '',
  rkt_type VARCHAR(30) NOT NULL DEFAULT 'Ketua', program_order INT NOT NULL DEFAULT 0,
  objective_order INT NOT NULL DEFAULT 0, indicator_order INT NOT NULL DEFAULT 0,
  year INT NOT NULL, scope VARCHAR(50) NOT NULL DEFAULT 'Instansi', program_activity LONGTEXT NOT NULL,
  strategic_objective LONGTEXT NOT NULL, objective LONGTEXT NOT NULL, indicator LONGTEXT NOT NULL,
  target VARCHAR(255) NOT NULL, unit VARCHAR(100) NOT NULL DEFAULT 'Persen', policy_owner_id BIGINT UNSIGNED NULL,
  notes LONGTEXT NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'Draft', created_by VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_rkt_year_scope (year, scope)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE action_plans (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, rkt_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(500) NOT NULL, description LONGTEXT NOT NULL, responsible_unit VARCHAR(255) NOT NULL DEFAULT '',
  pic_employee_id BIGINT UNSIGNED NULL, deadline DATE NULL, progress INT NOT NULL DEFAULT 0,
  realization LONGTEXT NOT NULL, evidence LONGTEXT NOT NULL,
  validation_status VARCHAR(50) NOT NULL DEFAULT 'Belum Diverifikasi', created_by VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_action_rkt (rkt_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE performance_agreements (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, employee_id BIGINT UNSIGNED NOT NULL,
  supervisor_id BIGINT UNSIGNED NULL, year INT NOT NULL,
  title VARCHAR(500) NOT NULL DEFAULT 'Perjanjian Kinerja Tahunan', agreement_level VARCHAR(100) NOT NULL DEFAULT 'Staf',
  source_type VARCHAR(100) NOT NULL DEFAULT 'TUSI Kesekretariatan', source_rkt_id BIGINT UNSIGNED NULL,
  source_action_plan_id BIGINT UNSIGNED NULL, parent_agreement_id BIGINT UNSIGNED NULL,
  coordination_commissioner_id BIGINT UNSIGNED NULL, source_description LONGTEXT NOT NULL,
  period_start DATE NOT NULL, period_end DATE NOT NULL, notes LONGTEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'Draft', created_by VARCHAR(255) NOT NULL,
  approved_by VARCHAR(255) NULL, approved_at DATETIME NULL, revision_notes LONGTEXT NOT NULL,
  version INT NOT NULL DEFAULT 1, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_pk_employee_year (employee_id, year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE performance_indicators (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, agreement_id BIGINT UNSIGNED NOT NULL,
  objective LONGTEXT NOT NULL, objective_group INT NOT NULL DEFAULT 1,
  objective_type VARCHAR(100) NOT NULL DEFAULT 'Sasaran Kegiatan', indicator LONGTEXT NOT NULL,
  target VARCHAR(255) NOT NULL, unit VARCHAR(100) NOT NULL DEFAULT 'Dokumen',
  target_display VARCHAR(255) NOT NULL DEFAULT '', source_rkt_id BIGINT UNSIGNED NULL,
  source_mapping JSON NOT NULL, realization LONGTEXT NOT NULL, achievement INT NOT NULL DEFAULT 0,
  progress INT NOT NULL DEFAULT 0, evidence LONGTEXT NOT NULL,
  validation_status VARCHAR(50) NOT NULL DEFAULT 'Belum Diverifikasi', validated_by VARCHAR(255) NULL,
  validated_at DATETIME NULL, notes LONGTEXT NOT NULL, sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX idx_indicator_agreement (agreement_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE performance_budgets (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, agreement_id BIGINT UNSIGNED NOT NULL,
  program_name VARCHAR(500) NOT NULL, output_description LONGTEXT NOT NULL,
  amount BIGINT NOT NULL DEFAULT 0, allocation_level VARCHAR(50) NOT NULL DEFAULT 'Program',
  confirmation_status VARCHAR(50) NOT NULL DEFAULT 'Tidak Perlu', confirmed_by VARCHAR(255) NULL,
  confirmed_at DATETIME NULL, sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX idx_budget_agreement (agreement_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE performance_evaluations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, agreement_id BIGINT UNSIGNED NOT NULL,
  indicator_id BIGINT UNSIGNED NOT NULL, period_type VARCHAR(30) NOT NULL,
  period_key VARCHAR(30) NOT NULL, progress INT NOT NULL DEFAULT 0,
  budget_realization BIGINT NOT NULL DEFAULT 0, output_realization LONGTEXT NOT NULL,
  problem_identification LONGTEXT NOT NULL, improvement_effort LONGTEXT NOT NULL,
  completed_activities LONGTEXT NOT NULL, evidence_links JSON NOT NULL, notes LONGTEXT NOT NULL,
  created_by VARCHAR(255) NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY evaluation_indicator_period_unique (indicator_id, period_type, period_key),
  INDEX idx_evaluation_agreement (agreement_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE active_user_sessions (
  user_email VARCHAR(255) PRIMARY KEY, session_hash CHAR(64) NOT NULL,
  created_at DATETIME NOT NULL, last_activity_at DATETIME NOT NULL, expires_at DATETIME NOT NULL,
  ip_address VARCHAR(100) NOT NULL DEFAULT '', user_agent LONGTEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE session_audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, user_email VARCHAR(255) NOT NULL,
  action VARCHAR(50) NOT NULL, ip_address VARCHAR(100) NOT NULL DEFAULT '', user_agent LONGTEXT NOT NULL,
  detail LONGTEXT NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_session_audit_user (user_email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE security_audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, actor_email VARCHAR(255) NOT NULL DEFAULT 'anonymous',
  actor_role VARCHAR(50) NOT NULL DEFAULT 'unknown', action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100) NOT NULL, resource_id VARCHAR(255) NOT NULL DEFAULT '',
  status VARCHAR(30) NOT NULL DEFAULT 'BERHASIL', reason LONGTEXT NOT NULL,
  before_data LONGTEXT NOT NULL, after_data LONGTEXT NOT NULL, ip_address VARCHAR(100) NOT NULL DEFAULT '',
  user_agent LONGTEXT NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_security_actor (actor_email), INDEX idx_security_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE security_rate_limits (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, identity_key VARCHAR(255) NOT NULL,
  action VARCHAR(100) NOT NULL, window_start DATETIME NOT NULL, request_count INT NOT NULL DEFAULT 1,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY rate_limit_identity_action_window_unique (identity_key, action, window_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE security_backup_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, requested_by VARCHAR(255) NOT NULL,
  backup_type VARCHAR(50) NOT NULL DEFAULT 'JSON_MANUAL', record_count INT NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL, notes LONGTEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- SNAPSHOT DATA EXISTING VERSI 55
-- Diekspor dari database aktif pada 2026-09-01.
-- Termasuk data demo, akun sistem, sesi, rate limit, dan audit.
-- Setelah migrasi, hapus sesi aktif dan wajibkan login ulang.
-- ============================================================
START TRANSACTION;

-- action_plans: 0 baris

-- active_user_sessions: 2 baris
INSERT INTO `active_user_sessions` (`user_email`, `session_hash`, `created_at`, `last_activity_at`, `expires_at`, `ip_address`, `user_agent`) VALUES
('kurzelaofficial@gmail.com', 'a5dcdd1dc82b91c74b3cf6cab7bbae08c049b986c1c04253c5bd80c8f762aa46', '2026-09-01 02:18:39', '2026-09-01 04:53:51', '2026-09-02 02:18:39', '2001:448a:5050:4751:ec66:ad41:cf10:2279', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36'),
('noorjihan1184@gmail.com', 'dc7e346d0342841f276f50d76dcf6e755ccc4c1f99009c3b5896ebf17b4a3c4f', '2026-09-01 03:48:59', '2026-09-01 04:10:03', '2026-09-02 03:48:59', '2404:c0:3179:1a9f:8c51:caff:fe30:70dc', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36');

-- activity_agendas: 0 baris

-- annual_work_plans: 0 baris

-- attendance_audit_logs: 0 baris

-- attendance_reopen_requests: 0 baris

-- attendance_settings: 1 baris
INSERT INTO `attendance_settings` (`id`, `monday_thursday_start`, `monday_thursday_end`, `friday_start`, `friday_end`, `grace_minutes`, `replacement_multiplier`, `morning_cutoff`, `updated_at`, `daily_close_enabled`, `daily_close_time`, `check_in_window_enabled`, `check_in_open_time`, `check_in_close_time`, `check_out_window_enabled`, `monday_thursday_check_out_open`, `friday_check_out_open`, `check_out_close_time`, `print_header`, `print_place`) VALUES
(1, '07:30', '16:00', '07:30', '16:30', 0, 1, '08:30', '2026-08-24 08:35:02', 0, '18:00', 0, '05:00', '08:30', 0, '16:00', '16:30', '23:59', 'KPU NGAWI', 'Ngawi');

-- attendances: 0 baris

-- demo_bootstrap_state: 1 baris
INSERT INTO `demo_bootstrap_state` (`id`, `version`, `applied_by`, `applied_at`) VALUES
(1, 'demo-organization-v1-2026-09-01', 'kurzelaofficial@gmail.com', '2026-09-01 02:14:15');

-- employees: 18 baris
INSERT INTO `employees` (`id`, `full_name`, `employee_number`, `email`, `phone`, `position`, `unit_subsection`, `direct_supervisor_id`, `employee_status`, `account_status`, `access_level`, `created_at`, `updated_at`, `organization_position_id`, `operator_attendance`, `operator_sakip`) VALUES
(75, 'Ketua Demo', 'DEMO-KETUA-001', NULL, '-', 'Ketua', 'Lembaga', NULL, 'Aktif', 'Dinonaktifkan', 'Viewer', '2026-09-01 02:14:09', '2026-09-01 02:14:09', 1, 0, 0),
(76, 'Anggota Demo 1', 'DEMO-ANGGOTA-001', NULL, '-', 'Anggota', 'Komisioner', 75, 'Aktif', 'Dinonaktifkan', 'Viewer', '2026-09-01 02:14:09', '2026-09-01 02:14:09', 2, 0, 0),
(77, 'Anggota Demo 2', 'DEMO-ANGGOTA-002', NULL, '-', 'Anggota', 'Komisioner', 75, 'Aktif', 'Dinonaktifkan', 'Viewer', '2026-09-01 02:14:09', '2026-09-01 02:14:09', 3, 0, 0),
(78, 'Anggota Demo 3', 'DEMO-ANGGOTA-003', NULL, '-', 'Anggota', 'Komisioner', 75, 'Aktif', 'Dinonaktifkan', 'Viewer', '2026-09-01 02:14:10', '2026-09-01 02:14:10', 4, 0, 0),
(79, 'Anggota Demo 4', 'DEMO-ANGGOTA-004', NULL, '-', 'Anggota', 'Komisioner', 75, 'Aktif', 'Dinonaktifkan', 'Viewer', '2026-09-01 02:14:10', '2026-09-01 02:14:10', 5, 0, 0),
(80, 'Sekretaris Demo', 'DEMO-SEKRETARIS-001', NULL, '-', 'Sekretaris', 'Sekretariat', NULL, 'Aktif', 'Dinonaktifkan', 'Admin', '2026-09-01 02:14:10', '2026-09-01 02:14:10', 6, 0, 0),
(81, 'Kasubag Rendatin Demo', 'DEMO-KASUBAG-RENDATIN', 'noorjihan1184@gmail.com', '-', 'Kasubag', 'Subbag Rendatin', 80, 'Aktif', 'Aktif', 'Super Admin', '2026-09-01 02:14:10', '2026-09-01 03:48:47', 7, 0, 0),
(82, 'Kasubag KUL Demo', 'DEMO-KASUBAG-KUL', NULL, '-', 'Kasubag', 'Subbag KUL', 80, 'Aktif', 'Dinonaktifkan', 'Editor', '2026-09-01 02:14:10', '2026-09-01 02:14:10', 10, 0, 0),
(83, 'Kasubag SDM Parmas Demo', 'DEMO-KASUBAG-SDM-PARMAS', NULL, '-', 'Kasubag', 'Subbag SDM Parmas', 80, 'Aktif', 'Dinonaktifkan', 'Editor', '2026-09-01 02:14:11', '2026-09-01 02:14:11', 13, 0, 0),
(84, 'Kasubag Tekhum Demo', 'DEMO-KASUBAG-TEKHUM', NULL, '-', 'Kasubag', 'Subbag Tekhum', 80, 'Aktif', 'Dinonaktifkan', 'Editor', '2026-09-01 02:14:11', '2026-09-01 02:14:11', 16, 0, 0),
(85, 'Staf Rendatin Demo 1', 'DEMO-STAF-RENDATIN-1', 'stephanusyogi12@gmail.com', '-', 'Staf', 'Subbag Rendatin', 81, 'Aktif', 'Dinonaktifkan', 'User', '2026-09-01 02:14:11', '2026-09-01 02:14:11', 8, 0, 0),
(86, 'Staf Rendatin Demo 2', 'DEMO-STAF-RENDATIN-2', NULL, '-', 'Staf', 'Subbag Rendatin', 81, 'Aktif', 'Dinonaktifkan', 'User', '2026-09-01 02:14:11', '2026-09-01 02:14:11', 9, 0, 0),
(87, 'Staf KUL Demo 1', 'DEMO-STAF-KUL-1', NULL, '-', 'Staf', 'Subbag KUL', 82, 'Aktif', 'Dinonaktifkan', 'User', '2026-09-01 02:14:12', '2026-09-01 02:14:12', 11, 0, 0),
(88, 'Staf KUL Demo 2', 'DEMO-STAF-KUL-2', NULL, '-', 'Staf', 'Subbag KUL', 82, 'Aktif', 'Dinonaktifkan', 'User', '2026-09-01 02:14:12', '2026-09-01 02:14:12', 12, 0, 0),
(89, 'Staf SDM Parmas Demo 1', 'DEMO-STAF-SDM-PARMAS-1', NULL, '-', 'Staf', 'Subbag SDM Parmas', 83, 'Aktif', 'Dinonaktifkan', 'User', '2026-09-01 02:14:12', '2026-09-01 02:14:12', 14, 0, 0),
(90, 'Staf SDM Parmas Demo 2', 'DEMO-STAF-SDM-PARMAS-2', NULL, '-', 'Staf', 'Subbag SDM Parmas', 83, 'Aktif', 'Dinonaktifkan', 'User', '2026-09-01 02:14:12', '2026-09-01 02:14:12', 15, 0, 0),
(91, 'Staf Tekhum Demo 1', 'DEMO-STAF-TEKHUM-1', NULL, '-', 'Staf', 'Subbag Tekhum', 84, 'Aktif', 'Dinonaktifkan', 'User', '2026-09-01 02:14:12', '2026-09-01 02:14:12', 17, 0, 0),
(92, 'Staf Tekhum Demo 2', 'DEMO-STAF-TEKHUM-2', NULL, '-', 'Staf', 'Subbag Tekhum', 84, 'Aktif', 'Dinonaktifkan', 'User', '2026-09-01 02:14:13', '2026-09-01 02:14:13', 18, 0, 0);

-- holidays: 0 baris

-- organization_coordinations: 4 baris
INSERT INTO `organization_coordinations` (`id`, `commissioner_employee_id`, `unit_subsection`, `created_at`) VALUES
(5, 76, 'Subbag Rendatin', '2026-09-01 02:14:14'),
(6, 77, 'Subbag Tekhum', '2026-09-01 02:14:15'),
(7, 78, 'Subbag Tekhum', '2026-09-01 02:14:15'),
(8, 79, 'Subbag SDM Parmas', '2026-09-01 02:14:15');

-- organization_positions: 18 baris
INSERT INTO `organization_positions` (`id`, `name`, `level`, `unit_id`, `reports_to_position_id`, `sort_order`, `status`, `created_at`, `updated_at`) VALUES
(1, 'Ketua', 'Ketua', 13, NULL, 1, 'Aktif', '2026-09-01 02:14:05', '2026-09-01 02:14:05'),
(2, 'Anggota 1', 'Anggota', 14, 1, 11, 'Aktif', '2026-09-01 02:14:05', '2026-09-01 02:14:05'),
(3, 'Anggota 2', 'Anggota', 14, 1, 12, 'Aktif', '2026-09-01 02:14:05', '2026-09-01 02:14:05'),
(4, 'Anggota 3', 'Anggota', 14, 1, 13, 'Aktif', '2026-09-01 02:14:06', '2026-09-01 02:14:06'),
(5, 'Anggota 4', 'Anggota', 14, 1, 14, 'Aktif', '2026-09-01 02:14:06', '2026-09-01 02:14:06'),
(6, 'Sekretaris', 'Sekretaris', 15, NULL, 20, 'Aktif', '2026-09-01 02:14:06', '2026-09-01 02:14:06'),
(7, 'Kasubag Rendatin', 'Kasubag', 16, 6, 31, 'Aktif', '2026-09-01 02:14:06', '2026-09-01 02:14:06'),
(8, 'Staf Rendatin 1', 'Staf', 16, 7, 311, 'Aktif', '2026-09-01 02:14:06', '2026-09-01 02:14:06'),
(9, 'Staf Rendatin 2', 'Staf', 16, 7, 312, 'Aktif', '2026-09-01 02:14:07', '2026-09-01 02:14:07'),
(10, 'Kasubag KUL', 'Kasubag', 17, 6, 32, 'Aktif', '2026-09-01 02:14:07', '2026-09-01 02:14:07'),
(11, 'Staf KUL 1', 'Staf', 17, 10, 321, 'Aktif', '2026-09-01 02:14:07', '2026-09-01 02:14:07'),
(12, 'Staf KUL 2', 'Staf', 17, 10, 322, 'Aktif', '2026-09-01 02:14:07', '2026-09-01 02:14:07'),
(13, 'Kasubag SDM Parmas', 'Kasubag', 18, 6, 33, 'Aktif', '2026-09-01 02:14:08', '2026-09-01 02:14:08'),
(14, 'Staf SDM Parmas 1', 'Staf', 18, 13, 331, 'Aktif', '2026-09-01 02:14:08', '2026-09-01 02:14:08'),
(15, 'Staf SDM Parmas 2', 'Staf', 18, 13, 332, 'Aktif', '2026-09-01 02:14:08', '2026-09-01 02:14:08'),
(16, 'Kasubag Tekhum', 'Kasubag', 19, 6, 34, 'Aktif', '2026-09-01 02:14:08', '2026-09-01 02:14:08'),
(17, 'Staf Tekhum 1', 'Staf', 19, 16, 341, 'Aktif', '2026-09-01 02:14:09', '2026-09-01 02:14:09'),
(18, 'Staf Tekhum 2', 'Staf', 19, 16, 342, 'Aktif', '2026-09-01 02:14:09', '2026-09-01 02:14:09');

-- organization_units: 7 baris
INSERT INTO `organization_units` (`id`, `name`, `type`, `parent_id`, `leader_employee_id`, `sort_order`, `status`, `created_at`, `updated_at`) VALUES
(13, 'Lembaga', 'Lembaga', NULL, 75, 1, 'Aktif', '2026-09-01 02:14:03', '2026-09-01 02:14:03'),
(14, 'Komisioner', 'Komisioner', 13, 75, 10, 'Aktif', '2026-09-01 02:14:04', '2026-09-01 02:14:04'),
(15, 'Sekretariat', 'Sekretariat', 13, 80, 20, 'Aktif', '2026-09-01 02:14:04', '2026-09-01 02:14:04'),
(16, 'Subbag Rendatin', 'Subbagian', 15, 81, 31, 'Aktif', '2026-09-01 02:14:04', '2026-09-01 03:48:48'),
(17, 'Subbag KUL', 'Subbagian', 15, 82, 32, 'Aktif', '2026-09-01 02:14:04', '2026-09-01 02:14:04'),
(18, 'Subbag SDM Parmas', 'Subbagian', 15, 83, 33, 'Aktif', '2026-09-01 02:14:04', '2026-09-01 02:14:04'),
(19, 'Subbag Tekhum', 'Subbagian', 15, 84, 34, 'Aktif', '2026-09-01 02:14:05', '2026-09-01 02:14:05');

-- other_attendances: 0 baris

-- performance_agreements: 0 baris

-- performance_budgets: 0 baris

-- performance_evaluations: 0 baris

-- performance_indicators: 0 baris

-- profiles: 1 baris
INSERT INTO `profiles` (`email`, `full_name`, `employee_number`, `unit`, `role`) VALUES
('datinkpungawi@gmail.com', 'Super Admin Datink', 'SA-001', 'Sekretariat', 'super_admin');

-- recurring_task_templates: 0 baris

-- security_audit_logs: 3 baris
INSERT INTO `security_audit_logs` (`id`, `actor_email`, `actor_role`, `action`, `resource_type`, `resource_id`, `status`, `reason`, `before_data`, `after_data`, `ip_address`, `user_agent`, `created_at`) VALUES
(323, 'kurzelaofficial@gmail.com', 'unknown', 'ACCESS_CHECK', 'api', '/api/me', 'DITOLAK', 'SESSION_REQUIRED', '', '', '2001:448a:5050:4751:ec66:ad41:cf10:2279', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36', '2026-09-01 02:16:14'),
(324, 'kurzelaofficial@gmail.com', 'super_user', 'MUTATION_AUTHORIZED', 'api', '/api/employees', 'BERHASIL', 'PATCH', '', '', '2001:448a:c050:77d:6908:9656:264a:9540', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36', '2026-09-01 03:48:46'),
(325, 'kurzelaofficial@gmail.com', 'super_user', 'UPDATE', 'employee', '81', 'BERHASIL', '', '{"id":81,"fullName":"Kasubag Rendatin Demo","employeeNumber":"DEMO-KASUBAG-RENDATIN","email":null,"phone":"-","position":"Kasubag","unitSubsection":"Subbag Rendatin","directSupervisorId":80,"organizationPositionId":7,"operatorAttendance":false,"operatorSakip":false,"employeeStatus":"Aktif","accountStatus":"Dinonaktifkan","accessLevel":"Editor","createdAt":"2026-09-01 02:14:10","updatedAt":"2026-09-01 02:14:10"}', '{"id":81,"fullName":"Kasubag Rendatin Demo","employeeNumber":"DEMO-KASUBAG-RENDATIN","email":"noorjihan1184@gmail.com","phone":"-","position":"Kasubag","unitSubsection":"Subbag Rendatin","directSupervisorId":80,"organizationPositionId":7,"operatorAttendance":false,"operatorSakip":false,"employeeStatus":"Aktif","accountStatus":"Aktif","accessLevel":"Super Admin","createdAt":"2026-09-01 02:14:10","updatedAt":"2026-09-01T03:48:47.464Z"}', '2001:448a:c050:77d:6908:9656:264a:9540', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36', '2026-09-01 03:48:48');

-- security_backup_logs: 0 baris

-- security_rate_limits: 3 baris
INSERT INTO `security_rate_limits` (`id`, `identity_key`, `action`, `window_start`, `request_count`, `updated_at`) VALUES
(22, 'kurzelaofficial@gmail.com', 'LOGIN_SESSION', '2026-09-01 03:47:51', 1, '2026-09-01 03:47:51'),
(23, 'kurzelaofficial@gmail.com', 'DATA_MUTATION', '2026-09-01 03:48:45', 1, '2026-09-01 03:48:46'),
(24, 'noorjihan1184@gmail.com', 'LOGIN_SESSION', '2026-09-01 04:10:01', 1, '2026-09-01 04:10:01');

-- session_audit_logs: 6 baris
INSERT INTO `session_audit_logs` (`id`, `user_email`, `action`, `ip_address`, `user_agent`, `detail`, `created_at`) VALUES
(136, 'kurzelaofficial@gmail.com', 'LOGIN', '2001:448a:5050:4751:ec66:ad41:cf10:2279', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36', 'Login berhasil', '2026-09-01 02:14:16'),
(137, 'kurzelaofficial@gmail.com', 'SESSION_REPLACED', '2001:448a:5050:4751:ec66:ad41:cf10:2279', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36', 'Sesi lama dicabut oleh login baru', '2026-09-01 02:16:09'),
(138, 'kurzelaofficial@gmail.com', 'LOGIN', '2001:448a:5050:4751:ec66:ad41:cf10:2279', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36', 'Login berhasil', '2026-09-01 02:16:10'),
(139, 'kurzelaofficial@gmail.com', 'SESSION_REPLACED', '2001:448a:5050:4751:ec66:ad41:cf10:2279', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36', 'Sesi lama dicabut oleh login baru', '2026-09-01 02:18:39'),
(140, 'kurzelaofficial@gmail.com', 'LOGIN', '2001:448a:5050:4751:ec66:ad41:cf10:2279', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36', 'Pengguna mengambil alih sesi', '2026-09-01 02:18:40'),
(141, 'noorjihan1184@gmail.com', 'LOGIN', '2404:c0:3179:1a9f:8c51:caff:fe30:70dc', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36', 'Login berhasil', '2026-09-01 03:48:59');

-- system_accounts: 2 baris
INSERT INTO `system_accounts` (`email`, `display_name`, `role`, `status`, `created_at`) VALUES
('kurzelaofficial@gmail.com', 'Kurzela Official', 'super_user', 'Aktif', '2026-08-23 18:31:42'),
('datinkpungawi@gmail.com', 'Super Admin Datink', 'super_user', 'Aktif', '2026-09-01 00:00:00');

-- task_progress_updates: 0 baris

-- tasks: 0 baris

COMMIT;
SET FOREIGN_KEY_CHECKS = 1;
