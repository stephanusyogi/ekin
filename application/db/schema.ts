import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  int,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const tasks = mysqlTable(
  "tasks",
  {
    id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
    ownerEmail: varchar("owner_email", { length: 255 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    unit: varchar("unit", { length: 255 }).notNull().default("Subbag Umum"),
    due: varchar("due", { length: 255 }).notNull().default("Belum ditentukan"),
    progress: int("progress").notNull().default(0),
    status: varchar("status", { length: 255 }).notNull().default("Baru"),
    picEmails: text("pic_emails").notNull(),
    priority: varchar("priority", { length: 255 }).notNull().default("Sedang"),
    outputType: varchar("output_type", { length: 255 }).notNull().default("Dokumen"),
    sourcePerformanceAgreementId: bigint("source_performance_agreement_id", { mode: "number" }),
    sourcePerformanceIndicatorId: bigint("source_performance_indicator_id", { mode: "number" }),
    createdBy: varchar("created_by", { length: 255 }).notNull().default(""),
    approvalStatus: varchar("approval_status", { length: 255 }).notNull().default("Tidak Perlu Persetujuan"),
    approvalRequestedAt: varchar("approval_requested_at", { length: 255 }),
    approvalDecidedBy: varchar("approval_decided_by", { length: 255 }),
    approvalDecidedAt: varchar("approval_decided_at", { length: 255 }),
    approvalNote: text("approval_note").notNull(),
    deadline: varchar("deadline", { length: 255 }).notNull().default(""),
    extendedDeadline: varchar("extended_deadline", { length: 255 }).notNull().default(""),
    output: text("output").notNull(),
    notes: text("notes").notNull(),
    verificationStatus: varchar("verification_status", { length: 255 })
      .notNull()
      .default("Belum Diverifikasi"),
    recurringTemplateId: bigint("recurring_template_id", { mode: "number" }),
    recurringPeriodKey: varchar("recurring_period_key", { length: 255 }).notNull().default(""),
    createdAt: varchar("created_at", { length: 255 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("task_recurring_period_unique").on(
      table.recurringTemplateId,
      table.recurringPeriodKey,
    ),
  ],
);

export const taskProgressUpdates = mysqlTable("task_progress_updates", {
  id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
  taskId: bigint("task_id", { mode: "number" }).notNull(),
  employeeEmail: varchar("employee_email", { length: 255 }).notNull(),
  progress: int("progress").notNull(),
  outputRealization: text("output_realization").notNull(),
  completedActivities: text("completed_activities").notNull(),
  obstacles: text("obstacles").notNull(),
  notes: text("notes").notNull(),
  createdAt: varchar("created_at", { length: 255 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const activityAgendas = mysqlTable("activity_agendas", {
  id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
  title: varchar("title", { length: 255 }).notNull(),
  startDate: varchar("start_date", { length: 255 }).notNull(),
  endDate: varchar("end_date", { length: 255 }).notNull(),
  startTime: varchar("start_time", { length: 255 }).notNull().default(""),
  endTime: varchar("end_time", { length: 255 }).notNull().default(""),
  location: varchar("location", { length: 255 }).notNull().default(""),
  unit: varchar("unit", { length: 255 }).notNull(),
  personInCharge: varchar("person_in_charge", { length: 255 }).notNull().default(""),
  description: text("description").notNull(),
  status: varchar("status", { length: 255 }).notNull().default("Akan Berjalan"),
  rescheduledDate: varchar("rescheduled_date", { length: 255 }).notNull().default(""),
  notes: text("notes").notNull(),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  createdAt: varchar("created_at", { length: 255 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: varchar("updated_at", { length: 255 }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const recurringTaskTemplates = mysqlTable("recurring_task_templates", {
  id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  unit: varchar("unit", { length: 255 }).notNull(),
  picEmails: text("pic_emails").notNull(),
  priority: varchar("priority", { length: 255 }).notNull().default("Sedang"),
  outputType: varchar("output_type", { length: 255 }).notNull().default("Dokumen"),
  sourcePerformanceAgreementId: bigint("source_performance_agreement_id", { mode: "number" }),
  sourcePerformanceIndicatorId: bigint("source_performance_indicator_id", { mode: "number" }),
  frequency: varchar("frequency", { length: 255 }).notNull(),
  generationDay: int("generation_day").notNull().default(1),
  dueOffsetDays: int("due_offset_days").notNull().default(7),
  startDate: varchar("start_date", { length: 255 }).notNull(),
  endDate: varchar("end_date", { length: 255 }).notNull().default(""),
  verifierEmail: varchar("verifier_email", { length: 255 }).notNull().default(""),
  notes: text("notes").notNull(),
  status: varchar("status", { length: 255 })
    .notNull()
    .default("Aktif"),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  createdAt: varchar("created_at", { length: 255 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: varchar("updated_at", { length: 255 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const organizationCoordinations = mysqlTable(
  "organization_coordinations",
  {
    id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
    commissionerEmployeeId: bigint("commissioner_employee_id", { mode: "number" }).notNull(),
    unitSubsection: varchar("unit_subsection", { length: 255 }).notNull(),
    createdAt: varchar("created_at", { length: 255 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("coordination_commissioner_unit_unique").on(
      table.commissionerEmployeeId,
      table.unitSubsection,
    ),
  ],
);

export const organizationUnits = mysqlTable("organization_units", {
  id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 100 }).notNull().default("Unit"),
  parentId: bigint("parent_id", { mode: "number" }),
  leaderEmployeeId: bigint("leader_employee_id", { mode: "number" }),
  sortOrder: int("sort_order").notNull().default(0),
  status: varchar("status", { length: 30 })
    .notNull()
    .default("Aktif"),
  createdAt: varchar("created_at", { length: 255 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: varchar("updated_at", { length: 255 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const organizationPositions = mysqlTable("organization_positions", {
  id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
  name: varchar("name", { length: 255 }).notNull(),
  level: varchar("level", { length: 30 }).notNull(),
  unitId: bigint("unit_id", { mode: "number" }).notNull(),
  reportsToPositionId: bigint("reports_to_position_id", { mode: "number" }),
  sortOrder: int("sort_order").notNull().default(0),
  status: varchar("status", { length: 30 }).notNull().default("Aktif"),
  createdAt: varchar("created_at", { length: 255 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: varchar("updated_at", { length: 255 }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const demoBootstrapState = mysqlTable("demo_bootstrap_state", {
  id: int("id").primaryKey().default(1),
  version: varchar("version", { length: 255 }).notNull(),
  appliedBy: varchar("applied_by", { length: 255 }).notNull(),
  appliedAt: varchar("applied_at", { length: 255 }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const attendances = mysqlTable(
  "attendances",
  {
    id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
    employeeEmail: varchar("employee_email", { length: 255 }).notNull(),
    workDate: varchar("work_date", { length: 255 }).notNull(),
    checkIn: varchar("check_in", { length: 255 }).notNull(),
    checkOut: varchar("check_out", { length: 255 }),
    workOutput: text("work_output").notNull(),
    location: varchar("location", { length: 255 }).notNull().default("Kantor Utama"),
    attendanceStatus: varchar("attendance_status", { length: 50 }).notNull().default("on_time"),
    lateMinutes: int("late_minutes").notNull().default(0),
    replacementMinutes: int("replacement_minutes").notNull().default(0),
    morningSession: boolean("morning_session")
      .notNull()
      .default(true),
    isHoliday: boolean("is_holiday")
      .notNull()
      .default(false),
    createdAt: varchar("created_at", { length: 255 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("attendance_employee_date_unique").on(
      table.employeeEmail,
      table.workDate,
    ),
  ],
);

export const attendanceSettings = mysqlTable("attendance_settings", {
  id: int("id").primaryKey().default(1),
  mondayThursdayStart: varchar("monday_thursday_start", { length: 5 }).notNull().default("07:30"),
  mondayThursdayEnd: varchar("monday_thursday_end", { length: 5 }).notNull().default("16:00"),
  fridayStart: varchar("friday_start", { length: 5 }).notNull().default("07:30"),
  fridayEnd: varchar("friday_end", { length: 5 }).notNull().default("16:30"),
  graceMinutes: int("grace_minutes").notNull().default(0),
  replacementMultiplier: int("replacement_multiplier").notNull().default(1),
  morningCutoff: varchar("morning_cutoff", { length: 5 }).notNull().default("08:30"),
  dailyCloseEnabled: boolean("daily_close_enabled")
    .notNull()
    .default(false),
  dailyCloseTime: varchar("daily_close_time", { length: 5 }).notNull().default("18:00"),
  checkInWindowEnabled: boolean("check_in_window_enabled")
    .notNull()
    .default(false),
  checkInOpenTime: varchar("check_in_open_time", { length: 5 }).notNull().default("05:00"),
  checkInCloseTime: varchar("check_in_close_time", { length: 5 }).notNull().default("08:30"),
  checkOutWindowEnabled: boolean("check_out_window_enabled")
    .notNull()
    .default(false),
  mondayThursdayCheckOutOpen: varchar("monday_thursday_check_out_open", { length: 5 })
    .notNull()
    .default("16:00"),
  fridayCheckOutOpen: varchar("friday_check_out_open", { length: 5 }).notNull().default("16:30"),
  checkOutCloseTime: varchar("check_out_close_time", { length: 5 }).notNull().default("23:59"),
  printHeader: text("print_header").notNull(),
  printPlace: varchar("print_place", { length: 255 }).notNull().default(""),
  updatedAt: varchar("updated_at", { length: 255 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const otherAttendances = mysqlTable("other_attendances", {
  id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
  employeeEmail: varchar("employee_email", { length: 255 }).notNull(),
  type: varchar("type", { length: 20 }).notNull(),
  startDate: varchar("start_date", { length: 255 }).notNull(),
  endDate: varchar("end_date", { length: 255 }).notNull(),
  durationDays: int("duration_days").notNull(),
  documentNumber: varchar("document_number", { length: 255 }).notNull().default(""),
  documentDate: varchar("document_date", { length: 255 }).notNull().default(""),
  leaveType: varchar("leave_type", { length: 100 }).notNull().default(""),
  destination: text("destination").notNull(),
  purpose: text("purpose").notNull(),
  notes: text("notes").notNull(),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  createdAt: varchar("created_at", { length: 255 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const attendanceReopenRequests = mysqlTable(
  "attendance_reopen_requests",
  {
    id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
    employeeEmail: varchar("employee_email", { length: 255 }).notNull(),
    workDate: varchar("work_date", { length: 255 }).notNull(),
    attendanceType: varchar("attendance_type", { length: 255 }).notNull().default("Absen Masuk"),
    reason: text("reason").notNull(),
    statementFileKey: varchar("statement_file_key", { length: 255 }).notNull().default(""),
    statementFileName: varchar("statement_file_name", { length: 255 }).notNull().default(""),
    statementFileType: varchar("statement_file_type", { length: 255 }).notNull().default(""),
    statementFileSize: int("statement_file_size").notNull().default(0),
    status: varchar("status", { length: 30 })
      .notNull()
      .default("Menunggu"),
    decidedBy: varchar("decided_by", { length: 255 }),
    decidedAt: varchar("decided_at", { length: 255 }),
    openUntil: varchar("open_until", { length: 255 }),
    createdAt: varchar("created_at", { length: 255 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
);

export const attendanceAuditLogs = mysqlTable("attendance_audit_logs", {
  id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
  employeeEmail: varchar("employee_email", { length: 255 }).notNull(),
  action: varchar("action", { length: 255 }).notNull(),
  workDate: varchar("work_date", { length: 255 }).notNull(),
  detail: text("detail").notNull(),
  actorEmail: varchar("actor_email", { length: 255 }).notNull(),
  createdAt: varchar("created_at", { length: 255 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const holidays = mysqlTable("holidays", {
  id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
  holidayDate: varchar("holiday_date", { length: 255 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  createdAt: varchar("created_at", { length: 255 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const profiles = mysqlTable("profiles", {
  email: varchar("email", { length: 255 }).primaryKey(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  employeeNumber: varchar("employee_number", { length: 100 }).notNull().default(""),
  unit: varchar("unit", { length: 255 }).notNull().default("Subbag Umum"),
  role: varchar("role", { length: 30 })
    .notNull()
    .default("user"),
});

export const systemAccounts = mysqlTable("system_accounts", {
  email: varchar("email", { length: 255 }).primaryKey(),
  displayName: varchar("display_name", { length: 255 }).notNull().default("Pemilik Sistem"),
  role: varchar("role", { length: 30 })
    .notNull()
    .default("super_user"),
  status: varchar("status", { length: 30 })
    .notNull()
    .default("Aktif"),
  createdAt: varchar("created_at", { length: 255 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const activeUserSessions = mysqlTable("active_user_sessions", {
  userEmail: varchar("user_email", { length: 255 }).primaryKey(),
  sessionHash: varchar("session_hash", { length: 255 }).notNull(),
  createdAt: varchar("created_at", { length: 255 }).notNull(),
  lastActivityAt: varchar("last_activity_at", { length: 255 }).notNull(),
  expiresAt: varchar("expires_at", { length: 255 }).notNull(),
  ipAddress: varchar("ip_address", { length: 255 }).notNull().default(""),
  userAgent: varchar("user_agent", { length: 255 }).notNull().default(""),
});

export const sessionAuditLogs = mysqlTable("session_audit_logs", {
  id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
  userEmail: varchar("user_email", { length: 255 }).notNull(),
  action: varchar("action", { length: 50 }).notNull(),
  ipAddress: varchar("ip_address", { length: 255 }).notNull().default(""),
  userAgent: varchar("user_agent", { length: 255 }).notNull().default(""),
  detail: text("detail").notNull(),
  createdAt: varchar("created_at", { length: 255 }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const securityAuditLogs = mysqlTable("security_audit_logs", {
  id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
  actorEmail: varchar("actor_email", { length: 255 }).notNull().default("anonymous"),
  actorRole: varchar("actor_role", { length: 255 }).notNull().default("unknown"),
  action: varchar("action", { length: 255 }).notNull(),
  resourceType: varchar("resource_type", { length: 255 }).notNull(),
  resourceId: varchar("resource_id", { length: 255 }).notNull().default(""),
  status: varchar("status", { length: 30 })
    .notNull()
    .default("BERHASIL"),
  reason: varchar("reason", { length: 255 }).notNull().default(""),
  beforeData: text("before_data").notNull(),
  afterData: text("after_data").notNull(),
  ipAddress: varchar("ip_address", { length: 255 }).notNull().default(""),
  userAgent: varchar("user_agent", { length: 255 }).notNull().default(""),
  createdAt: varchar("created_at", { length: 255 }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const securityRateLimits = mysqlTable(
  "security_rate_limits",
  {
    id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
    identityKey: varchar("identity_key", { length: 255 }).notNull(),
    action: varchar("action", { length: 100 }).notNull(),
    windowStart: varchar("window_start", { length: 255 }).notNull(),
    requestCount: int("request_count").notNull().default(1),
    updatedAt: varchar("updated_at", { length: 255 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("security_rate_identity_action_unique").on(table.identityKey, table.action)],
);

export const securityBackupLogs = mysqlTable("security_backup_logs", {
  id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
  requestedBy: varchar("requested_by", { length: 255 }).notNull(),
  backupType: varchar("backup_type", { length: 50 }).notNull().default("JSON_MANUAL"),
  recordCount: int("record_count").notNull().default(0),
  status: varchar("status", { length: 30 }).notNull(),
  notes: text("notes").notNull(),
  createdAt: varchar("created_at", { length: 255 }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const employees = mysqlTable("employees", {
  id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  employeeNumber: varchar("employee_number", { length: 100 }).notNull().unique(),
  email: varchar("email", { length: 255 }).unique(),
  phone: varchar("phone", { length: 100 }).notNull(),
  position: varchar("position", { length: 255 }).notNull().default(""),
  unitSubsection: varchar("unit_subsection", { length: 255 }).notNull().default("Sekretariat"),
  directSupervisorId: bigint("direct_supervisor_id", { mode: "number" }),
  organizationPositionId: bigint("organization_position_id", { mode: "number" }),
  operatorAttendance: boolean("operator_attendance").notNull().default(false),
  operatorSakip: boolean("operator_sakip").notNull().default(false),
  employeeStatus: varchar("employee_status", { length: 30 })
    .notNull()
    .default("Aktif"),
  accountStatus: varchar("account_status", { length: 30 })
    .notNull()
    .default("Aktif"),
  accessLevel: varchar("access_level", { length: 30 })
    .notNull()
    .default("User"),
  createdAt: varchar("created_at", { length: 255 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: varchar("updated_at", { length: 255 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const performanceAgreements = mysqlTable("performance_agreements", {
  id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
  employeeId: bigint("employee_id", { mode: "number" }).notNull(),
  supervisorId: bigint("supervisor_id", { mode: "number" }),
  year: int("year").notNull(),
  title: varchar("title", { length: 255 }).notNull().default("Perjanjian Kinerja Tahunan"),
  agreementLevel: varchar("agreement_level", { length: 255 }).notNull().default("Staf"),
  sourceType: varchar("source_type", { length: 255 }).notNull().default("TUSI Kesekretariatan"),
  sourceRktId: bigint("source_rkt_id", { mode: "number" }),
  sourceActionPlanId: bigint("source_action_plan_id", { mode: "number" }),
  parentAgreementId: bigint("parent_agreement_id", { mode: "number" }),
  coordinationCommissionerId: bigint("coordination_commissioner_id", { mode: "number" }),
  sourceDescription: text("source_description").notNull(),
  periodStart: varchar("period_start", { length: 255 }).notNull(),
  periodEnd: varchar("period_end", { length: 255 }).notNull(),
  notes: text("notes").notNull(),
  status: varchar("status", { length: 30 })
    .notNull()
    .default("Draft"),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  approvedBy: varchar("approved_by", { length: 255 }),
  approvedAt: varchar("approved_at", { length: 255 }),
  revisionNotes: text("revision_notes").notNull(),
  version: int("version").notNull().default(1),
  createdAt: varchar("created_at", { length: 255 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: varchar("updated_at", { length: 255 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const performanceIndicators = mysqlTable("performance_indicators", {
  id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
  agreementId: bigint("agreement_id", { mode: "number" }).notNull(),
  objective: text("objective").notNull(),
  objectiveGroup: int("objective_group").notNull().default(1),
  objectiveType: varchar("objective_type", { length: 255 })
    .notNull()
    .default("Sasaran Kegiatan"),
  indicator: text("indicator").notNull(),
  target: varchar("target", { length: 255 }).notNull(),
  unit: varchar("unit", { length: 255 }).notNull().default("Dokumen"),
  targetDisplay: varchar("target_display", { length: 255 }).notNull().default(""),
  sourceRktId: bigint("source_rkt_id", { mode: "number" }),
  sourceMapping: text("source_mapping").notNull(),
  realization: text("realization").notNull(),
  achievement: int("achievement").notNull().default(0),
  progress: int("progress").notNull().default(0),
  evidence: text("evidence").notNull(),
  validationStatus: varchar("validation_status", { length: 255 })
    .notNull()
    .default("Belum Diverifikasi"),
  validatedBy: varchar("validated_by", { length: 255 }),
  validatedAt: varchar("validated_at", { length: 255 }),
  notes: text("notes").notNull(),
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: varchar("created_at", { length: 255 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const performanceBudgets = mysqlTable("performance_budgets", {
  id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
  agreementId: bigint("agreement_id", { mode: "number" }).notNull(),
  programName: varchar("program_name", { length: 255 }).notNull(),
  outputDescription: text("output_description").notNull(),
  amount: bigint("amount", { mode: "number" }).notNull().default(0),
  allocationLevel: varchar("allocation_level", { length: 255 }).notNull().default("Program"),
  confirmationStatus: varchar("confirmation_status", { length: 30 })
    .notNull()
    .default("Tidak Perlu"),
  confirmedBy: varchar("confirmed_by", { length: 255 }),
  confirmedAt: varchar("confirmed_at", { length: 255 }),
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: varchar("created_at", { length: 255 }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const performanceEvaluations = mysqlTable(
  "performance_evaluations",
  {
    id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
    agreementId: bigint("agreement_id", { mode: "number" }).notNull(),
    indicatorId: bigint("indicator_id", { mode: "number" }).notNull(),
    periodType: varchar("period_type", { length: 30 }).notNull(),
    periodKey: varchar("period_key", { length: 255 }).notNull(),
    progress: int("progress").notNull().default(0),
    budgetRealization: bigint("budget_realization", { mode: "number" }).notNull().default(0),
    outputRealization: text("output_realization").notNull(),
    problemIdentification: text("problem_identification").notNull(),
    improvementEffort: text("improvement_effort").notNull(),
    completedActivities: text("completed_activities").notNull(),
    evidenceLinks: text("evidence_links").notNull(),
    notes: text("notes").notNull(),
    createdBy: varchar("created_by", { length: 255 }).notNull(),
    createdAt: varchar("created_at", { length: 255 }).notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: varchar("updated_at", { length: 255 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("evaluation_indicator_period_unique").on(table.indicatorId, table.periodType, table.periodKey)],
);

export const annualWorkPlans = mysqlTable("annual_work_plans", {
  id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
  documentKey: varchar("document_key", { length: 255 }).notNull().default(""),
  rktType: varchar("rkt_type", { length: 30 })
    .notNull()
    .default("Ketua"),
  programOrder: int("program_order").notNull().default(0),
  objectiveOrder: int("objective_order").notNull().default(0),
  indicatorOrder: int("indicator_order").notNull().default(0),
  year: int("year").notNull(),
  scope: varchar("scope", { length: 30 })
    .notNull()
    .default("Instansi"),
  programActivity: text("program_activity").notNull(),
  strategicObjective: text("strategic_objective").notNull(),
  objective: text("objective").notNull(),
  indicator: text("indicator").notNull(),
  target: varchar("target", { length: 255 }).notNull(),
  unit: varchar("unit", { length: 255 }).notNull().default("Persen"),
  policyOwnerId: bigint("policy_owner_id", { mode: "number" }),
  notes: text("notes").notNull(),
  status: varchar("status", { length: 30 })
    .notNull()
    .default("Draft"),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  createdAt: varchar("created_at", { length: 255 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: varchar("updated_at", { length: 255 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const actionPlans = mysqlTable("action_plans", {
  id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
  rktId: bigint("rkt_id", { mode: "number" }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  responsibleUnit: varchar("responsible_unit", { length: 255 }).notNull().default(""),
  picEmployeeId: bigint("pic_employee_id", { mode: "number" }),
  deadline: varchar("deadline", { length: 255 }).notNull().default(""),
  progress: int("progress").notNull().default(0),
  realization: text("realization").notNull(),
  evidence: text("evidence").notNull(),
  validationStatus: varchar("validation_status", { length: 255 })
    .notNull()
    .default("Belum Diverifikasi"),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  createdAt: varchar("created_at", { length: 255 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: varchar("updated_at", { length: 255 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});
