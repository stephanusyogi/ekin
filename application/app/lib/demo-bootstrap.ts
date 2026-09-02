import { eq, ne } from "drizzle-orm";
import { getDb } from "../../db";
import {
  actionPlans, activeUserSessions, activityAgendas, annualWorkPlans,
  attendanceAuditLogs, attendanceReopenRequests, attendances, demoBootstrapState,
  employees, holidays, organizationCoordinations, organizationPositions,
  organizationUnits, otherAttendances, performanceAgreements, performanceBudgets,
  performanceEvaluations, performanceIndicators, profiles, recurringTaskTemplates,
  securityAuditLogs, securityBackupLogs, securityRateLimits, sessionAuditLogs,
  systemAccounts, taskProgressUpdates, tasks,
} from "../../db/schema";

const DEMO_VERSION = "demo-organization-v1-2026-09-01";

type PositionLevel = "Ketua" | "Anggota" | "Sekretaris" | "Kasubag" | "Staf";
type AccessLevel = "Admin" | "Editor" | "User" | "Viewer";

export async function ensureDemoDatabase(superUserEmail: string) {
  const db = getDb();
  const [applied] = await db.select().from(demoBootstrapState).where(eq(demoBootstrapState.id, 1)).limit(1);
  if (applied?.version === DEMO_VERSION) return false;
  if (applied?.version === "PENDING") return false;

  if (applied) {
    await db.update(demoBootstrapState).set({ version: "PENDING", appliedBy: superUserEmail, appliedAt: new Date().toISOString().slice(0, 19).replace('T', ' ') }).where(eq(demoBootstrapState.id, 1));
  } else {
    await db.insert(demoBootstrapState).values({ id: 1, version: "PENDING", appliedBy: superUserEmail });
  }

  try {
    for (const table of [
      taskProgressUpdates, tasks, recurringTaskTemplates, activityAgendas,
      performanceEvaluations, performanceBudgets, performanceIndicators,
      performanceAgreements, actionPlans, annualWorkPlans,
      attendanceAuditLogs, attendanceReopenRequests, attendances, otherAttendances,
      holidays, organizationCoordinations, employees, organizationPositions,
      organizationUnits, profiles, activeUserSessions, sessionAuditLogs,
      securityAuditLogs, securityRateLimits, securityBackupLogs,
    ]) await db.delete(table);
    await db.delete(systemAccounts).where(ne(systemAccounts.email, superUserEmail));

    const insertUnit = async (name: string, type: string, parentId: number | null, sortOrder: number) => {
      const [res] = await db.insert(organizationUnits).values({ name, type, parentId, sortOrder, status: "Aktif" });
      const [row] = await db.select().from(organizationUnits).where(eq(organizationUnits.id, res.insertId)).limit(1);
      return row;
    };
    const lembaga = await insertUnit("Lembaga", "Lembaga", null, 1);
    const komisioner = await insertUnit("Komisioner", "Komisioner", lembaga.id, 10);
    const sekretariat = await insertUnit("Sekretariat", "Sekretariat", lembaga.id, 20);
    const rendatin = await insertUnit("Subbag Rendatin", "Subbagian", sekretariat.id, 31);
    const kul = await insertUnit("Subbag KUL", "Subbagian", sekretariat.id, 32);
    const sdmParmas = await insertUnit("Subbag SDM Parmas", "Subbagian", sekretariat.id, 33);
    const tekhum = await insertUnit("Subbag Tekhum", "Subbagian", sekretariat.id, 34);

    const insertPosition = async (name: string, level: PositionLevel, unitId: number, reportsToPositionId: number | null, sortOrder: number) => {
      const [res] = await db.insert(organizationPositions).values({ name, level, unitId, reportsToPositionId, sortOrder, status: "Aktif" });
      const [row] = await db.select().from(organizationPositions).where(eq(organizationPositions.id, res.insertId)).limit(1);
      return row;
    };
    const chair = await insertPosition("Ketua", "Ketua", lembaga.id, null, 1);
    const memberPositions = [];
    for (let n = 1; n <= 4; n++) memberPositions.push(await insertPosition(`Anggota ${n}`, "Anggota", komisioner.id, chair.id, 10 + n));
    const secretary = await insertPosition("Sekretaris", "Sekretaris", sekretariat.id, null, 20);
    const subbagSpecs = [
      { unit: rendatin, label: "Rendatin", order: 31 },
      { unit: kul, label: "KUL", order: 32 },
      { unit: sdmParmas, label: "SDM Parmas", order: 33 },
      { unit: tekhum, label: "Tekhum", order: 34 },
    ];
    const managerPositions = new Map<string, typeof organizationPositions.$inferSelect>();
    const staffPositions: Array<{ label: string; position: typeof organizationPositions.$inferSelect; number: number }> = [];
    for (const spec of subbagSpecs) {
      const manager = await insertPosition(`Kasubag ${spec.label}`, "Kasubag", spec.unit.id, secretary.id, spec.order);
      managerPositions.set(spec.label, manager);
      for (let n = 1; n <= 2; n++) staffPositions.push({ label: spec.label, number: n, position: await insertPosition(`Staf ${spec.label} ${n}`, "Staf", spec.unit.id, manager.id, spec.order * 10 + n) });
    }

    const employeesByPosition = new Map<number, typeof employees.$inferSelect>();
    const createEmployee = async (fullName: string, employeeNumber: string, position: typeof organizationPositions.$inferSelect, unitName: string, accessLevel: AccessLevel) => {
      const supervisor = position.reportsToPositionId ? employeesByPosition.get(position.reportsToPositionId) : null;
      const [res] = await db.insert(employees).values({
        fullName, employeeNumber, email: null, phone: "-", position: position.level,
        unitSubsection: unitName, directSupervisorId: supervisor?.id || null,
        organizationPositionId: position.id, operatorAttendance: false, operatorSakip: false,
        employeeStatus: "Aktif", accountStatus: "Dinonaktifkan", accessLevel,
      });
      const [row] = await db.select().from(employees).where(eq(employees.id, res.insertId)).limit(1);
      employeesByPosition.set(position.id, row);
      return row;
    };
    const chairEmployee = await createEmployee("Ketua Demo", "DEMO-KETUA-001", chair, "Lembaga", "Viewer");
    const memberEmployees = [];
    for (let n = 0; n < memberPositions.length; n++) memberEmployees.push(await createEmployee(`Anggota Demo ${n + 1}`, `DEMO-ANGGOTA-${String(n + 1).padStart(3, "0")}`, memberPositions[n], "Komisioner", "Viewer"));
    const secretaryEmployee = await createEmployee("Sekretaris Demo", "DEMO-SEKRETARIS-001", secretary, "Sekretariat", "Admin");
    const managerEmployees = new Map<string, typeof employees.$inferSelect>();
    for (const spec of subbagSpecs) managerEmployees.set(spec.label, await createEmployee(`Kasubag ${spec.label} Demo`, `DEMO-KASUBAG-${spec.label.replaceAll(" ", "-").toUpperCase()}`, managerPositions.get(spec.label)!, spec.unit.name, "Editor"));
    for (const item of staffPositions) await createEmployee(`Staf ${item.label} Demo ${item.number}`, `DEMO-STAF-${item.label.replaceAll(" ", "-").toUpperCase()}-${item.number}`, item.position, subbagSpecs.find((spec) => spec.label === item.label)!.unit.name, "User");

    await db.update(organizationUnits).set({ leaderEmployeeId: chairEmployee.id }).where(eq(organizationUnits.id, lembaga.id));
    await db.update(organizationUnits).set({ leaderEmployeeId: chairEmployee.id }).where(eq(organizationUnits.id, komisioner.id));
    await db.update(organizationUnits).set({ leaderEmployeeId: secretaryEmployee.id }).where(eq(organizationUnits.id, sekretariat.id));
    for (const spec of subbagSpecs) await db.update(organizationUnits).set({ leaderEmployeeId: managerEmployees.get(spec.label)!.id }).where(eq(organizationUnits.id, spec.unit.id));

    const coordinationSeeds = [
      [memberEmployees[0].id, rendatin.name],
      [memberEmployees[1].id, tekhum.name],
      [memberEmployees[2].id, tekhum.name],
      [memberEmployees[3].id, sdmParmas.name],
    ] as const;
    for (const [commissionerEmployeeId, unitSubsection] of coordinationSeeds) await db.insert(organizationCoordinations).values({ commissionerEmployeeId, unitSubsection });

    await db.update(demoBootstrapState).set({ version: DEMO_VERSION, appliedBy: superUserEmail, appliedAt: new Date().toISOString().slice(0, 19).replace('T', ' ') }).where(eq(demoBootstrapState.id, 1));
    return true;
  } catch (error) {
    await db.delete(demoBootstrapState).where(eq(demoBootstrapState.id, 1));
    throw error;
  }
}
