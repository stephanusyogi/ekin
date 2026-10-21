import { asc, inArray } from "drizzle-orm";
import { getDb } from "../../../db";
import { employees, performanceAgreements, performanceIndicators, tasks } from "../../../db/schema";
import { requireAuthorizedUser } from "../../lib/access";
import { generateRecurringTasks } from "../../lib/recurring-tasks";
import {
  canUserApproveTask,
  enrichTaskWithPicNames,
  isTaskVisible,
  resolveTaskAccessScope,
} from "../../lib/task-visibility";

export async function GET(request: Request) {
  const identity = await requireAuthorizedUser(request);
  await generateRecurringTasks();
  const db = getDb();
  const allEmployees = await db.select().from(employees);
  const [employee] = allEmployees.filter(e => e.email?.toLowerCase() === identity.email.toLowerCase());
  const allTasks = await db.select().from(tasks).orderBy(asc(tasks.deadline));

  const accessScope = await resolveTaskAccessScope(identity, allEmployees);
  const visible = allTasks.filter(task => isTaskVisible(task, identity.email, accessScope));

  const canApproveTaskIds = visible
    .filter(task => canUserApproveTask(task, identity.email, accessScope))
    .map(task => task.id);

  const sourceIndicatorIds = visible
    .map(task => task.sourcePerformanceIndicatorId)
    .filter((id): id is number => Boolean(id));
  const sourceIndicators = sourceIndicatorIds.length
    ? await db.select().from(performanceIndicators).where(inArray(performanceIndicators.id, sourceIndicatorIds))
    : [];
  const sourceAgreementIds = [...new Set(sourceIndicators.map(indicator => indicator.agreementId))];
  const sourceAgreements = sourceAgreementIds.length
    ? await db.select().from(performanceAgreements).where(inArray(performanceAgreements.id, sourceAgreementIds))
    : [];

  const normalizedStatus = (task: typeof tasks.$inferSelect) => {
    if (task.approvalStatus === "Draft") return "Baru";
    if (task.approvalStatus === "Menunggu Persetujuan") return "Menunggu Verifikasi";
    if (task.approvalStatus === "Ditolak") return "Ditolak";
    if (task.verificationStatus === "Perlu Perbaikan" || task.approvalStatus === "Perlu Perbaikan") return "Perbaikan";
    if (task.verificationStatus === "Terverifikasi" || task.status === "Selesai") return "Selesai";
    if (task.progress >= 100 || task.verificationStatus === "Menunggu Verifikasi") return "Verifikasi Final";
    if (task.progress > 0 || ["Belum Mulai", "Proses", "Tertunda", "Dikerjakan"].includes(task.status)) return "Dikerjakan";
    return "Baru";
  };

  const enriched = visible.map(task => {
    const indicator = sourceIndicators.find(row => row.id === task.sourcePerformanceIndicatorId),
      agreement = indicator ? sourceAgreements.find(row => row.id === indicator.agreementId) : null,
      owner = agreement ? allEmployees.find(row => row.id === agreement.employeeId) : null;
    const enrichedWithPics = enrichTaskWithPicNames(task, allEmployees);
    return {
      ...enrichedWithPics,
      status: normalizedStatus(task),
      sourcePkLabel: indicator
        ? `${owner?.position || agreement?.agreementLevel || "PK"} · ${indicator.indicator}`
        : "",
    };
  });

  return Response.json({
    tasks: enriched,
    scope: accessScope.scopeLabel,
    allowedUnits: accessScope.coordinatedUnits,
    canApproveTaskIds,
    identity: { position: employee?.position || "", role: identity.role },
  });
}
