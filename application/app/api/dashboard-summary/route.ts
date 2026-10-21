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
import { hasSakipOperator, requireAuthorizedUser } from "../../lib/access";
import { generateRecurringTasks } from "../../lib/recurring-tasks";
import {
  getSubordinateEmployeeIds,
  isTaskVisible,
  resolveTaskAccessScope,
} from "../../lib/task-visibility";

export async function GET(request: Request) {
  const identity = await requireAuthorizedUser(request);
  await generateRecurringTasks();
  const db = getDb();
  const allEmployees = await db.select().from(employees);
  const [employee] = allEmployees.filter(e => e.email?.toLowerCase() === identity.email.toLowerCase());
  const all = await db.select().from(tasks).orderBy(asc(tasks.deadline));
  const todayKey=new Date().toISOString().slice(0,10),todayAgendas=(await db.select().from(activityAgendas).orderBy(asc(activityAgendas.startTime))).filter(a=>a.startDate<=todayKey&&a.endDate>=todayKey&&a.status!=="Batal");

  const accessScope = await resolveTaskAccessScope(identity, allEmployees);
  const visible = all.filter(task => isTaskVisible(task, identity.email, accessScope));
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
  const canManageAllPk =
    ["super_user", "super_admin", "admin"].includes(identity.role) ||
    hasSakipOperator(identity) ||
    employee?.position === "Ketua" ||
    employee?.position === "Sekretaris";
  const subordinateIds = employee
    ? getSubordinateEmployeeIds(
        employee.id,
        allEmployees,
        employee.position,
        employee.unitSubsection,
      )
    : new Set<number>();
  const allPk = await db.select().from(performanceAgreements);
  let visiblePk = allPk;
  if (!canManageAllPk) {
    if (employee?.position === "Anggota") {
      const links = await db
        .select()
        .from(organizationCoordinations)
        .where(eq(organizationCoordinations.commissionerEmployeeId, employee.id));
      const coordinatedUnits = links.map((x) => x.unitSubsection);

      visiblePk = allPk.filter((p) => {
        if (p.employeeId === employee.id) return true;
        if (p.coordinationCommissionerId === employee.id) return true;
        if (p.agreementLevel === "Ketua") return true;
        const owner = allEmployees.find((e) => e.id === p.employeeId);
        return Boolean(owner && coordinatedUnits.includes(owner.unitSubsection));
      });
    } else {
      visiblePk = allPk.filter(
        (p) =>
          p.employeeId === employee?.id ||
          p.supervisorId === employee?.id ||
          subordinateIds.has(p.employeeId),
      );
    }
  }
  const pkIds = visiblePk.map((p) => p.id);
  const pkIndicators = pkIds.length
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
