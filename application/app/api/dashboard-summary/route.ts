import { asc, eq, inArray } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  employees,
  activityAgendas,
  organizationCoordinations,
  performanceAgreements,
  performanceIndicators,
  tasks,
} from "../../../db/schema";
import { requireAuthorizedUser } from "../../lib/access";
import { generateRecurringTasks } from "../../lib/recurring-tasks";

export async function GET(request: Request) {
  const identity = await requireAuthorizedUser(request);
  await generateRecurringTasks();
  const db = getDb();
  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.email, identity.email))
    .limit(1);
  const all = await db.select().from(tasks).orderBy(asc(tasks.deadline));
  const todayKey=new Date().toISOString().slice(0,10),todayAgendas=(await db.select().from(activityAgendas).orderBy(asc(activityAgendas.startTime))).filter(a=>a.startDate<=todayKey&&a.endDate>=todayKey&&a.status!=="Batal");
  const parsePics = (raw: any): string[] => {
    if (Array.isArray(raw)) return raw;
    try { return typeof raw === "string" ? JSON.parse(raw) : []; }
    catch { return []; }
  };
  let visible = all.filter(
    (task) =>
      task.ownerEmail === identity.email ||
      parsePics(task.picEmails).includes(identity.email),
  );
  if (
    ["super_user", "super_admin", "admin"].includes(identity.role) ||
    employee?.position === "Sekretaris" ||
    employee?.position === "Ketua"
  )
    visible = all;
  else if (employee?.position === "Anggota") {
    const links = await db
      .select()
      .from(organizationCoordinations)
      .where(eq(organizationCoordinations.commissionerEmployeeId, employee.id));
    const units = links.map((link) => link.unitSubsection);
    visible = all.filter((task) => units.includes(task.unit));
  } else if (employee?.position.toLowerCase().includes("kasubag"))
    visible = all.filter((task) => task.unit === employee.unitSubsection);
  const active = visible.filter(
      (task) => task.status !== "Selesai" && task.progress < 100,
    ),
    completed = visible.filter(
      (task) => task.status === "Selesai" || task.progress >= 100,
    ),
    today = new Date().toISOString().slice(0, 10);
  const attention = active.filter(
    (task) =>
      task.priority === "Urgent" ||
      Boolean(task.deadline && task.deadline < today),
  );
  const allPk = await db.select().from(performanceAgreements),
    visiblePk = ["super_user", "super_admin", "admin"].includes(identity.role)
      ? allPk
      : allPk.filter(
          (p) =>
            p.employeeId === employee?.id || p.supervisorId === employee?.id,
        ),
    pkIds = visiblePk.map((p) => p.id),
    pkIndicators = pkIds.length
      ? await db
          .select()
          .from(performanceIndicators)
          .where(inArray(performanceIndicators.agreementId, pkIds))
      : [];
  return Response.json({
    activeTodoCount: active.length,
    notificationCount:
      active.length + visiblePk.filter((p) => p.status === "Diajukan").length,
    completedCount: completed.length,
    attentionCount: attention.length,
    averageProgress: visible.length
      ? Math.round(
          visible.reduce((sum, task) => sum + task.progress, 0) /
            visible.length,
        )
      : 0,
    pkCount: visiblePk.length,
    pkPending: visiblePk.filter((p) => p.status === "Diajukan").length,
    pkProgress: pkIndicators.length
      ? Math.round(
          pkIndicators.reduce((s, i) => s + i.progress, 0) /
            pkIndicators.length,
        )
      : 0,
    tasks: active.slice(0, 3),
    todayAgendas,
  });
}
