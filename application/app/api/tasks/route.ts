import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { employees, organizationUnits, taskProgressUpdates, tasks } from "../../../db/schema";
import { hasSakipOperator, requireAuthorizedUser } from "../../lib/access";
import { generateRecurringTasks } from "../../lib/recurring-tasks";
import { allowedTaskAssignees } from "../../lib/task-assignees";
import { allowedTaskPerformanceSources } from "../../lib/task-performance-sources";
import { logSecurityEvent } from "../../lib/security";

const picsOf = (task: typeof tasks.$inferSelect) => {
  const raw = task.picEmails as any;
  if (Array.isArray(raw)) return raw as string[];
  try { return typeof raw === "string" ? JSON.parse(raw) as string[] : []; }
  catch { return []; }
};

export async function GET(request: Request) {
  const user=await requireAuthorizedUser(request); await generateRecurringTasks();
  const all=await getDb().select().from(tasks).orderBy(desc(tasks.createdAt));
  const rows=all.filter(task=>picsOf(task).map(x=>x.toLowerCase()).includes(user.email.toLowerCase())).slice(0,50);
  const taskId=Number(new URL(request.url).searchParams.get("taskId")||0);
  if(taskId){
    const task=rows.find(row=>row.id===taskId);
    if(!task)return Response.json({error:"To-Do tidak ditemukan atau bukan tanggung jawab Anda"},{status:404});
    const history=await getDb().select().from(taskProgressUpdates).where(eq(taskProgressUpdates.taskId,taskId)).orderBy(desc(taskProgressUpdates.createdAt)).limit(20);
    return Response.json({task,history});
  }
  return Response.json({ tasks: rows });
}

export async function POST(request: Request) {
  const user=await requireAuthorizedUser(request);
  if(user.role==="viewer"&&!hasSakipOperator(user))return Response.json({error:"Viewer tidak dapat membuat To-Do"},{status:403});
  const payload = await request.json() as { title?: string; unit?:string; picEmails?:string[]; priority?:string; outputType?:string; sourcePerformanceAgreementId?:number; sourcePerformanceIndicatorId?:number; deadline?:string; output?:string; notes?:string };
  const title = payload.title?.trim();
  if (!title) return Response.json({ error: "Nama pekerjaan wajib diisi" }, { status: 400 });
  const unit=payload.unit?.trim();
  if(!unit)return Response.json({error:"Pilih Unit/Subbagian"},{status:400});
  const units=await getDb().select().from(organizationUnits);
  const registeredUnit=units.find(row=>row.name===unit&&row.status==="Aktif");
  if(!registeredUnit)return Response.json({error:"Unit/Subbagian belum terdaftar atau tidak aktif"},{status:400});
  const allowed=new Set((await allowedTaskAssignees(user)).map(employee=>employee.email!.toLowerCase()));
  const pics=(payload.picEmails||[]).map(email=>email.toLowerCase()).filter(email=>allowed.has(email));
  if(!pics.length)return Response.json({error:"Pilih minimal satu PIC dari diri sendiri atau pegawai bawahan"},{status:400});
  const requestedIndicatorId=Number(payload.sourcePerformanceIndicatorId||0),requestedAgreementId=Number(payload.sourcePerformanceAgreementId||0);
  if(Boolean(requestedIndicatorId)!==Boolean(requestedAgreementId))return Response.json({error:"Pilih sumber PK dan indikator yang lengkap"},{status:400});
  if(requestedIndicatorId){const permitted=(await allowedTaskPerformanceSources(user)).some(source=>source.indicatorId===requestedIndicatorId&&source.agreementId===requestedAgreementId);if(!permitted)return Response.json({error:"PK berada di luar jalur koordinasi Anda"},{status:403})}
  const outputTypes=["Dokumen","Laporan","Data","File spreadsheet","Presentasi","Komunikasi","Arsip","Jadwal","Hasil kegiatan","Rekomendasi"],outputType=outputTypes.includes(payload.outputType||"")?payload.outputType!:"Dokumen";
  const needsApproval=user.role==="user";
  const [res] = await getDb().insert(tasks).values({ ownerEmail:pics[0], createdBy:user.email, title, unit, picEmails:JSON.stringify(pics), priority:payload.priority||"Sedang", outputType, sourcePerformanceAgreementId:requestedAgreementId||null, sourcePerformanceIndicatorId:requestedIndicatorId||null, deadline:payload.deadline||"", due:payload.deadline||"Belum ditentukan", output:payload.output?.trim()||"", notes:payload.notes?.trim()||"", status:"Baru",approvalStatus:needsApproval?"Draft":"Tidak Perlu Persetujuan" });
  const [task] = await getDb().select().from(tasks).where(eq(tasks.id, res.insertId)).limit(1);
  return Response.json({ task }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user=await requireAuthorizedUser(request);
  if(user.role==="viewer"&&!hasSakipOperator(user))return Response.json({error:"Viewer tidak dapat memperbarui To-Do"},{status:403});
  const payload = await request.json() as { id?: number; action?:"edit_unstarted"|"request_approval"|"approve"|"reject"|"needs_revision"|"verify_complete"|"verify_revision"; title?:string; unit?:string; picEmails?:string[]; priority?:string; outputType?:string; sourcePerformanceAgreementId?:number|null; sourcePerformanceIndicatorId?:number|null; deadline?:string; output?:string; progress?: number; outputRealization?:string; completedActivities?:string; obstacles?:string; notes?:string; decisionNote?:string };
  if (!payload.id) return Response.json({ error: "Data tidak lengkap" }, { status: 400 });
  const [before]=await getDb().select().from(tasks).where(eq(tasks.id,payload.id)).limit(1);
  if(!before)return Response.json({error:"To-Do tidak ditemukan"},{status:404});
  if(payload.action==="edit_unstarted"){
    if(user.role!=="editor"||before.createdBy.toLowerCase()!==user.email.toLowerCase())return Response.json({error:"Hanya Kasubag pembuat To-Do yang dapat mengedit"},{status:403});
    if(before.progress!==0||before.status!=="Baru")return Response.json({error:"To-Do hanya dapat diedit sebelum mulai dikerjakan"},{status:409});
    const title=payload.title?.trim()||"",unit=payload.unit?.trim()||"";if(!title||!unit)return Response.json({error:"Uraian dan Unit/Subbagian wajib diisi"},{status:400});
    const [registeredUnit]=await getDb().select({id:organizationUnits.id}).from(organizationUnits).where(eq(organizationUnits.name,unit)).limit(1);if(!registeredUnit)return Response.json({error:"Unit/Subbagian tidak terdaftar"},{status:400});
    const allowed=new Set((await allowedTaskAssignees(user)).map(employee=>employee.email!.toLowerCase())),pics=(payload.picEmails||[]).map(email=>email.toLowerCase()).filter(email=>allowed.has(email));if(!pics.length)return Response.json({error:"Pilih minimal satu PIC dalam garis instruksi"},{status:400});
    const requestedIndicatorId=Number(payload.sourcePerformanceIndicatorId||0),requestedAgreementId=Number(payload.sourcePerformanceAgreementId||0);if(Boolean(requestedIndicatorId)!==Boolean(requestedAgreementId))return Response.json({error:"Sumber PK tidak lengkap"},{status:400});if(requestedIndicatorId){const permitted=(await allowedTaskPerformanceSources(user)).some(source=>source.indicatorId===requestedIndicatorId&&source.agreementId===requestedAgreementId);if(!permitted)return Response.json({error:"PK berada di luar jalur koordinasi Anda"},{status:403})}
    const outputTypes=["Dokumen","Laporan","Data","File spreadsheet","Presentasi","Komunikasi","Arsip","Jadwal","Hasil kegiatan","Rekomendasi"],outputType=outputTypes.includes(payload.outputType||"")?payload.outputType!:"Dokumen";
    await getDb().update(tasks).set({title,unit,picEmails:JSON.stringify(pics),ownerEmail:pics[0],priority:payload.priority||"Sedang",outputType,sourcePerformanceAgreementId:requestedAgreementId||null,sourcePerformanceIndicatorId:requestedIndicatorId||null,deadline:payload.deadline||"",due:payload.deadline||"Belum ditentukan",output:payload.output?.trim()||"",notes:payload.notes?.trim()||""}).where(eq(tasks.id,payload.id));
    const [task]=await getDb().select().from(tasks).where(eq(tasks.id,payload.id)).limit(1);
    await logSecurityEvent(request,{actorEmail:user.email,actorRole:user.role,action:"EDIT_UNSTARTED_TASK",resourceType:"task",resourceId:payload.id,before,after:task});return Response.json({task});
  }
  if(payload.action==="request_approval"){
    if(before.createdBy.toLowerCase()!==user.email.toLowerCase()||before.approvalStatus!=="Draft")return Response.json({error:"To-Do tidak dapat diajukan"},{status:403});
    await getDb().update(tasks).set({approvalStatus:"Menunggu Persetujuan",approvalRequestedAt:new Date().toISOString().slice(0, 19).replace('T', ' '),status:"Menunggu Verifikasi"}).where(eq(tasks.id,payload.id));
    const [task]=await getDb().select().from(tasks).where(eq(tasks.id,payload.id)).limit(1);
    await logSecurityEvent(request,{actorEmail:user.email,actorRole:user.role,action:"REQUEST_TASK_APPROVAL",resourceType:"task",resourceId:payload.id,before,after:task});
    return Response.json({task});
  }
  if(["approve","reject","needs_revision"].includes(payload.action||"")){
    const allEmployees=await getDb().select().from(employees),creator=allEmployees.find(e=>e.email?.toLowerCase()===before.createdBy.toLowerCase()),approver=allEmployees.find(e=>e.email?.toLowerCase()===user.email.toLowerCase());
    const allowed=["super_user","super_admin"].includes(user.role)||Boolean(creator&&approver&&creator.directSupervisorId===approver.id);
    if(!allowed)return Response.json({error:"Hanya atasan langsung yang dapat memutuskan"},{status:403});
    const note=payload.decisionNote?.trim()||"";if(payload.action!=="approve"&&!note)return Response.json({error:"Catatan keputusan wajib diisi"},{status:400});
    const approved=payload.action==="approve",approvalStatus=approved?"Disetujui":payload.action==="reject"?"Ditolak":"Perlu Perbaikan";
    await getDb().update(tasks).set({approvalStatus,approvalDecidedBy:user.email,approvalDecidedAt:new Date().toISOString().slice(0, 19).replace('T', ' '),approvalNote:note,status:approved?"Dikerjakan":payload.action==="reject"?"Ditolak":"Perbaikan"}).where(eq(tasks.id,payload.id));
    const [task]=await getDb().select().from(tasks).where(eq(tasks.id,payload.id)).limit(1);
    await logSecurityEvent(request,{actorEmail:user.email,actorRole:user.role,action:`TASK_APPROVAL_${payload.action.toUpperCase()}`,resourceType:"task",resourceId:payload.id,reason:note,before,after:task});
    return Response.json({task});
  }
  if(["verify_complete","verify_revision"].includes(payload.action||"")){
    const allEmployees=await getDb().select().from(employees),approver=allEmployees.find(e=>e.email?.toLowerCase()===user.email.toLowerCase()),picEmails=picsOf(before).map(x=>x.toLowerCase()),picRows=allEmployees.filter(e=>e.email&&picEmails.includes(e.email.toLowerCase()));
    const allowed=["super_user","super_admin"].includes(user.role)||Boolean(approver&&picRows.some(pic=>pic.directSupervisorId===approver.id));
    if(!allowed)return Response.json({error:"Hanya atasan langsung PIC yang dapat memverifikasi hasil akhir"},{status:403});
    if(before.status!=="Verifikasi Final"&&before.verificationStatus!=="Menunggu Verifikasi")return Response.json({error:"To-Do belum berada pada tahap verifikasi final"},{status:409});
    const completed=payload.action==="verify_complete",note=payload.decisionNote?.trim()||"";if(!completed&&!note)return Response.json({error:"Catatan perbaikan wajib diisi"},{status:400});
    await getDb().update(tasks).set({status:completed?"Selesai":"Perbaikan",verificationStatus:completed?"Terverifikasi":"Perlu Perbaikan",approvalNote:note||before.approvalNote}).where(eq(tasks.id,payload.id));
    const [task]=await getDb().select().from(tasks).where(eq(tasks.id,payload.id)).limit(1);
    await logSecurityEvent(request,{actorEmail:user.email,actorRole:user.role,action:completed?"VERIFY_TASK_COMPLETE":"VERIFY_TASK_REVISION",resourceType:"task",resourceId:payload.id,reason:note,before,after:task});
    return Response.json({task});
  }
  if(payload.progress === undefined)return Response.json({error:"Progress wajib diisi"},{status:400});
  if(!before||!picsOf(before).map(x=>x.toLowerCase()).includes(user.email.toLowerCase()))return Response.json({error:"Hanya PIC pekerjaan yang dapat memperbarui progres"},{status:403});
  if(["Draft","Menunggu Persetujuan","Ditolak","Perlu Perbaikan"].includes(before.approvalStatus))return Response.json({error:"To-Do harus disetujui sebelum progress diperbarui"},{status:409});
  const progress = Math.max(0, Math.min(100, Math.round(Number(payload.progress))));
  const outputRealization=payload.outputRealization?.trim()||"";
  const completedActivities=payload.completedActivities?.trim()||"";
  const obstacles=payload.obstacles?.trim()||"";
  const notes=payload.notes?.trim()||"";
  if(!completedActivities)return Response.json({error:"Kegiatan yang sudah dilaksanakan wajib diisi"},{status:400});
  if(progress===100&&!outputRealization)return Response.json({error:"Realisasi output wajib diisi saat progres mencapai 100%"},{status:400});
  await getDb().update(tasks).set({
    progress,
    status: progress === 100 ? "Verifikasi Final" : "Dikerjakan",
    verificationStatus: progress === 100 ? "Menunggu Verifikasi" : "Belum Diverifikasi",
    output: outputRealization || before.output,
    notes: notes || before.notes,
  }).where(eq(tasks.id, payload.id));
  const [task]=await getDb().select().from(tasks).where(eq(tasks.id,payload.id)).limit(1);
  const [uRes]=await getDb().insert(taskProgressUpdates).values({taskId:payload.id,employeeEmail:user.email,progress,outputRealization,completedActivities,obstacles,notes});
  const [update]=await getDb().select().from(taskProgressUpdates).where(eq(taskProgressUpdates.id,uRes.insertId)).limit(1);
  await logSecurityEvent(request,{actorEmail:user.email,actorRole:user.role,action:"UPDATE_PROGRESS",resourceType:"task",resourceId:payload.id,before:{progress:before.progress,status:before.status},after:{progress:task.progress,status:task.status,updateId:update.id}});
  return Response.json({ task, update });
}
