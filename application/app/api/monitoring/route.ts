import { asc, eq, inArray } from "drizzle-orm";
import { getDb } from "../../../db";
import { employees, organizationCoordinations, performanceAgreements, performanceIndicators, tasks } from "../../../db/schema";
import { hasSakipOperator, requireAuthorizedUser } from "../../lib/access";
import { generateRecurringTasks } from "../../lib/recurring-tasks";

export async function GET(request: Request) {
  const identity = await requireAuthorizedUser(request); await generateRecurringTasks(); const db = getDb();
  const [employee] = await db.select().from(employees).where(eq(employees.email, identity.email)).limit(1);
  const allTasks = await db.select().from(tasks).orderBy(asc(tasks.deadline));
  const allEmployees = await db.select().from(employees);
  const directEmails = new Set(
    allEmployees
      .filter(row => row.directSupervisorId === employee?.id && row.email)
      .map(row => row.email!.toLowerCase()),
  );
  const parsePics = (raw: any): string[] => {
    if (Array.isArray(raw)) return raw;
    try { return typeof raw === "string" ? JSON.parse(raw) : []; }
    catch { return []; }
  };
  const createdByDirectReport = (task: typeof tasks.$inferSelect) =>
    directEmails.has((task.createdBy || task.ownerEmail).toLowerCase());
  const assignedToDirectReport = (task: typeof tasks.$inferSelect) => {
    return parsePics(task.picEmails).some(email => directEmails.has(email.toLowerCase()));
  };
  let scope = "Pribadi"; let allowedUnits: string[] = [];
  let visible = allTasks.filter(t => t.ownerEmail === identity.email || parsePics(t.picEmails).includes(identity.email));
  if (identity.role === "super_user" || identity.role === "super_admin" || identity.role === "admin" || employee?.position === "Sekretaris") { visible = allTasks; scope = "Seluruh lembaga"; }
  else if (hasSakipOperator(identity)) { visible = allTasks.filter(task => Boolean(task.sourcePerformanceAgreementId)); scope = "To-Do terkait RKT/PK seluruh lembaga"; }
  else if (employee?.position === "Ketua") { visible = allTasks; scope = "Ringkasan seluruh lembaga"; }
  else if (employee?.position === "Anggota") { const links = await db.select().from(organizationCoordinations).where(eq(organizationCoordinations.commissionerEmployeeId, employee.id)); allowedUnits = links.map(x => x.unitSubsection); visible = allTasks.filter(t => allowedUnits.includes(t.unit)); scope = "Subbagian dalam garis koordinasi"; }
  else if (identity.role === "editor" || employee?.position.toLowerCase().includes("kasubag")) {
    allowedUnits = [employee!.unitSubsection];
    visible = allTasks.filter(task =>
      task.unit === employee!.unitSubsection ||
      task.createdBy.toLowerCase() === identity.email.toLowerCase() ||
      createdByDirectReport(task) ||
      assignedToDirectReport(task),
    );
    scope = `PIC bawahan langsung dan Unit ${employee!.unitSubsection}`;
  }
  const canApproveTaskIds = visible
    .filter(task => ["super_user", "super_admin"].includes(identity.role) || createdByDirectReport(task) || assignedToDirectReport(task))
    .map(task => task.id);
  const sourceIndicatorIds=visible.map(task=>task.sourcePerformanceIndicatorId).filter((id):id is number=>Boolean(id));
  const sourceIndicators=sourceIndicatorIds.length?await db.select().from(performanceIndicators).where(inArray(performanceIndicators.id,sourceIndicatorIds)):[];
  const sourceAgreementIds=[...new Set(sourceIndicators.map(indicator=>indicator.agreementId))];
  const sourceAgreements=sourceAgreementIds.length?await db.select().from(performanceAgreements).where(inArray(performanceAgreements.id,sourceAgreementIds)):[];
  const normalizedStatus=(task:typeof tasks.$inferSelect)=>{if(task.approvalStatus==="Draft")return"Baru";if(task.approvalStatus==="Menunggu Persetujuan")return"Menunggu Verifikasi";if(task.approvalStatus==="Ditolak")return"Ditolak";if(task.verificationStatus==="Perlu Perbaikan"||task.approvalStatus==="Perlu Perbaikan")return"Perbaikan";if(task.verificationStatus==="Terverifikasi"||task.status==="Selesai")return"Selesai";if(task.progress>=100||task.verificationStatus==="Menunggu Verifikasi")return"Verifikasi Final";if(task.progress>0||["Belum Mulai","Proses","Tertunda","Dikerjakan"].includes(task.status))return"Dikerjakan";return"Baru"};
  const enriched=visible.map(task=>{const indicator=sourceIndicators.find(row=>row.id===task.sourcePerformanceIndicatorId),agreement=indicator?sourceAgreements.find(row=>row.id===indicator.agreementId):null,owner=agreement?allEmployees.find(row=>row.id===agreement.employeeId):null;return{...task,status:normalizedStatus(task),sourcePkLabel:indicator?`${owner?.position||agreement?.agreementLevel||"PK"} · ${indicator.indicator}`:""}});
  return Response.json({ tasks: enriched, scope, allowedUnits, canApproveTaskIds, identity: { position: employee?.position || "", role: identity.role } });
}
