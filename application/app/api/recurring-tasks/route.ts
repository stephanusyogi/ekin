import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { organizationUnits, recurringTaskTemplates } from "../../../db/schema";
import { hasSakipOperator, requireAuthorizedUser } from "../../lib/access";
import { generateRecurringTasks } from "../../lib/recurring-tasks";
import { allowedTaskAssignees } from "../../lib/task-assignees";
import { allowedTaskPerformanceSources } from "../../lib/task-performance-sources";

const canManage = (user: Awaited<ReturnType<typeof requireAuthorizedUser>>) => ["super_user", "super_admin", "admin", "editor"].includes(user.role) || hasSakipOperator(user);

export async function GET(request: Request) {
  const user = await requireAuthorizedUser(request);
  const generated = await generateRecurringTasks();
  const templates = await getDb().select().from(recurringTaskTemplates).orderBy(desc(recurringTaskTemplates.createdAt));
  return Response.json({ templates, generated, canManage: canManage(user) });
}

export async function POST(request: Request) {
  const user = await requireAuthorizedUser(request);
  if (!canManage(user)) return Response.json({ error: "Tidak memiliki kewenangan" }, { status: 403 });
  const p = await request.json() as Record<string, unknown>;
  if (!String(p.title || "").trim() || !String(p.unit || "").trim() || !String(p.startDate || "").trim()) return Response.json({ error: "Nama, unit, dan tanggal mulai wajib diisi" }, { status: 400 });
  const unit=String(p.unit).trim();
  const [registeredUnit]=await getDb().select({id:organizationUnits.id}).from(organizationUnits).where(and(eq(organizationUnits.name,unit),eq(organizationUnits.status,"Aktif"))).limit(1);
  if(!registeredUnit)return Response.json({error:"Unit/Subbagian belum terdaftar atau tidak aktif"},{status:400});
  const frequency = ["Mingguan", "Bulanan", "Triwulan", "Semester"].includes(String(p.frequency)) ? String(p.frequency) as "Mingguan"|"Bulanan"|"Triwulan"|"Semester" : "Bulanan";
  const requestedEmails = Array.isArray(p.picEmails) ? p.picEmails.map(x => String(x).trim().toLowerCase()).filter(Boolean) : [];
  const allowedEmails = new Set((await allowedTaskAssignees(user)).map(employee => employee.email!.toLowerCase()));
  const emails = requestedEmails.filter(email => allowedEmails.has(email));
  if (!emails.length) return Response.json({ error: "Pilih minimal satu PIC dari diri sendiri atau pegawai bawahan" }, { status: 400 });
  const sourcePerformanceAgreementId=Number(p.sourcePerformanceAgreementId||0),sourcePerformanceIndicatorId=Number(p.sourcePerformanceIndicatorId||0);
  if(Boolean(sourcePerformanceAgreementId)!==Boolean(sourcePerformanceIndicatorId))return Response.json({error:"Pilih sumber PK dan indikator yang lengkap"},{status:400});
  if(sourcePerformanceIndicatorId){const permitted=(await allowedTaskPerformanceSources(user)).some(source=>source.agreementId===sourcePerformanceAgreementId&&source.indicatorId===sourcePerformanceIndicatorId);if(!permitted)return Response.json({error:"PK berada di luar jalur koordinasi Anda"},{status:403})}
  const outputTypes=["Dokumen","Laporan","Data","File spreadsheet","Presentasi","Komunikasi","Arsip","Jadwal","Hasil kegiatan","Rekomendasi"],outputType=outputTypes.includes(String(p.outputType||""))?String(p.outputType):"Dokumen";
  const [res] = await getDb().insert(recurringTaskTemplates).values({ title:String(p.title).trim(), description:String(p.description||"").trim(), unit, picEmails:JSON.stringify(emails), priority:String(p.priority||"Sedang"), outputType, sourcePerformanceAgreementId:sourcePerformanceAgreementId||null, sourcePerformanceIndicatorId:sourcePerformanceIndicatorId||null, frequency, generationDay:Math.max(1,Math.min(28,Number(p.generationDay)||1)), dueOffsetDays:Math.max(0,Number(p.dueOffsetDays)||0), startDate:String(p.startDate), endDate:String(p.endDate||""), verifierEmail:String(p.verifierEmail||"").trim().toLowerCase(), notes:String(p.notes||"").trim(), status:"Aktif", createdBy:user.email });
  const [template] = await getDb().select().from(recurringTaskTemplates).where(eq(recurringTaskTemplates.id, res.insertId)).limit(1);
  await generateRecurringTasks();
  return Response.json({ template }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await requireAuthorizedUser(request);
  if (!canManage(user)) return Response.json({ error: "Tidak memiliki kewenangan" }, { status: 403 });
  const p = await request.json() as { id?:number; status?:"Aktif"|"Dijeda"|"Nonaktif" };
  if (!p.id || !["Aktif","Dijeda","Nonaktif"].includes(String(p.status))) return Response.json({ error: "Data tidak lengkap" }, { status: 400 });
  await getDb().update(recurringTaskTemplates).set({ status:p.status!, updatedAt:new Date().toISOString().slice(0, 19).replace('T', ' ') }).where(eq(recurringTaskTemplates.id,p.id));
  const [template] = await getDb().select().from(recurringTaskTemplates).where(eq(recurringTaskTemplates.id, p.id)).limit(1);
  return Response.json({ template });
}
