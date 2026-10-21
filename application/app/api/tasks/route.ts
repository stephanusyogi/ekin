import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { employees, organizationUnits, taskProgressUpdates, tasks } from "../../../db/schema";
import { hasSakipOperator, requireAuthorizedUser } from "../../lib/access";
import { generateRecurringTasks } from "../../lib/recurring-tasks";
import { allowedTaskAssignees } from "../../lib/task-assignees";
import { allowedTaskPerformanceSources } from "../../lib/task-performance-sources";
import { logSecurityEvent } from "../../lib/security";
import {
  canUserApproveTask,
  enrichTaskWithPicNames,
  isTaskVisible,
  parsePics as picsOf,
  resolveTaskAccessScope,
} from "../../lib/task-visibility";

export async function GET(request: Request) {
  const user = await requireAuthorizedUser(request);
  await generateRecurringTasks();
  const url = new URL(request.url);
  const taskId = Number(url.searchParams.get("taskId") || 0);

  const allEmployees = await getDb().select().from(employees);
  const scope = await resolveTaskAccessScope(user, allEmployees);

  if (taskId) {
    const [task] = await getDb().select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
    if (!task) return Response.json({ error: "To-Do tidak ditemukan" }, { status: 404 });

    if (!isTaskVisible(task, user.email, scope)) {
      return Response.json({ error: "To-Do tidak ditemukan atau berada di luar kewenangan Anda" }, { status: 403 });
    }

    const history = await getDb()
      .select()
      .from(taskProgressUpdates)
      .where(eq(taskProgressUpdates.taskId, taskId))
      .orderBy(desc(taskProgressUpdates.createdAt))
      .limit(50);
    return Response.json({ task: enrichTaskWithPicNames(task, allEmployees), history });
  }

  const all = await getDb().select().from(tasks).orderBy(desc(tasks.createdAt));
  const rows = all
    .filter(task => isTaskVisible(task, user.email, scope))
    .slice(0, 100)
    .map(task => enrichTaskWithPicNames(task, allEmployees));
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
  const outputType = (payload.outputType?.trim() || "Dokumen").slice(0, 50);
  const isSupervisorOrAdmin = ["super_user", "super_admin", "admin", "editor"].includes(user.role);
  const needsApproval = !isSupervisorOrAdmin;
  const [res] = await getDb().insert(tasks).values({ ownerEmail:pics[0], createdBy:user.email, title, unit, picEmails:JSON.stringify(pics), priority:payload.priority||"Sedang", outputType, sourcePerformanceAgreementId:requestedAgreementId||null, sourcePerformanceIndicatorId:requestedIndicatorId||null, deadline:payload.deadline||"", due:payload.deadline||"Belum ditentukan", output:payload.output?.trim()||"", notes:payload.notes?.trim()||"", approvalNote: "", status:"Baru",approvalStatus:needsApproval?"Draft":"Tidak Perlu Persetujuan" });
  const [task] = await getDb().select().from(tasks).where(eq(tasks.id, res.insertId)).limit(1);
  return Response.json({ task }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user=await requireAuthorizedUser(request);
  if(user.role==="viewer"&&!hasSakipOperator(user))return Response.json({error:"Viewer tidak dapat memperbarui To-Do"},{status:403});
  const payload = await request.json() as { id?: number; action?:"edit_unstarted"|"supervisor_edit"|"request_approval"|"approve"|"reject"|"needs_revision"|"verify_complete"|"verify_revision"; title?:string; unit?:string; picEmails?:string[]; priority?:string; outputType?:string; sourcePerformanceAgreementId?:number|null; sourcePerformanceIndicatorId?:number|null; deadline?:string; output?:string; progress?: number; outputRealization?:string; completedActivities?:string; obstacles?:string; notes?:string; decisionNote?:string };
  if (!payload.id) return Response.json({ error: "Data tidak lengkap" }, { status: 400 });
  const [before]=await getDb().select().from(tasks).where(eq(tasks.id,payload.id)).limit(1);
  if(!before)return Response.json({error:"To-Do tidak ditemukan"},{status:404});
  if(payload.action==="edit_unstarted" || payload.action==="supervisor_edit"){
    const allEmployees=await getDb().select().from(employees);
    const scope=await resolveTaskAccessScope(user,allEmployees);
    const isSupervisor=canUserApproveTask(before,user.email,scope);
    const isCreator=before.createdBy.toLowerCase()===user.email.toLowerCase();
    const canAdmin=["super_user","super_admin"].includes(user.role);

    if(!isSupervisor && !isCreator && !canAdmin){
      return Response.json({error:"Hanya pembuat, atasan langsung, atau admin yang dapat mengedit To-Do ini"},{status:403});
    }

    const title=payload.title?.trim()||before.title;
    const unit=payload.unit?.trim()||before.unit;
    const updateData: any = { title, unit };

    if (Array.isArray(payload.picEmails) && payload.picEmails.length > 0) {
      const cleanPics = payload.picEmails.map((e: string) => e.toLowerCase().trim()).filter(Boolean);
      if (cleanPics.length > 0) {
        updateData.picEmails = JSON.stringify(cleanPics);
        updateData.ownerEmail = cleanPics[0];
      }
    }
    if (payload.deadline !== undefined) {
      updateData.deadline = payload.deadline || "";
      updateData.due = payload.deadline || "Belum ditentukan";
    }
    if ((payload as any).extendedDeadline !== undefined) {
      updateData.extendedDeadline = (payload as any).extendedDeadline || "";
    }
    if (payload.priority) {
      updateData.priority = payload.priority;
    }
    if (payload.outputType) {
      updateData.outputType = payload.outputType;
    }
    if (payload.output !== undefined) {
      updateData.output = payload.output?.trim() || "";
    }
    if (payload.notes !== undefined) {
      updateData.notes = payload.notes?.trim() || "";
    }
    if (payload.sourcePerformanceAgreementId !== undefined) {
      updateData.sourcePerformanceAgreementId = payload.sourcePerformanceAgreementId;
    }
    if (payload.sourcePerformanceIndicatorId !== undefined) {
      updateData.sourcePerformanceIndicatorId = payload.sourcePerformanceIndicatorId;
    }

    await getDb().update(tasks).set(updateData).where(eq(tasks.id,payload.id));
    const [task]=await getDb().select().from(tasks).where(eq(tasks.id,payload.id)).limit(1);
    await logSecurityEvent(request,{actorEmail:user.email,actorRole:user.role,action:"SUPERVISOR_EDIT_TASK",resourceType:"task",resourceId:payload.id,before,after:task});
    return Response.json({task});
  }
  if(payload.action==="request_approval"){
    if(before.createdBy.toLowerCase()!==user.email.toLowerCase()||before.approvalStatus!=="Draft")return Response.json({error:"To-Do tidak dapat diajukan"},{status:403});
    await getDb().update(tasks).set({approvalStatus:"Menunggu Persetujuan",approvalRequestedAt:new Date().toISOString().slice(0, 19).replace('T', ' '),status:"Menunggu Verifikasi"}).where(eq(tasks.id,payload.id));
    const [task]=await getDb().select().from(tasks).where(eq(tasks.id,payload.id)).limit(1);
    await logSecurityEvent(request,{actorEmail:user.email,actorRole:user.role,action:"REQUEST_TASK_APPROVAL",resourceType:"task",resourceId:payload.id,before,after:task});
    return Response.json({task});
  }
  if(["approve","reject","needs_revision"].includes(payload.action||"")){
    const allEmployees=await getDb().select().from(employees);
    const scope=await resolveTaskAccessScope(user,allEmployees);
    const allowed=canUserApproveTask(before,user.email,scope);
    if(!allowed)return Response.json({error:"Hanya atasan langsung/pimpinan yang dapat memutuskan"},{status:403});
    const note=payload.decisionNote?.trim()||"";if(payload.action!=="approve"&&!note)return Response.json({error:"Catatan keputusan wajib diisi"},{status:400});
    const approved=payload.action==="approve",approvalStatus=approved?"Disetujui":payload.action==="reject"?"Ditolak":"Perlu Perbaikan";

    const updateData: any = {
      approvalStatus,
      approvalDecidedBy: user.email,
      approvalDecidedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
      approvalNote: note,
      status: approved ? "Dikerjakan" : payload.action === "reject" ? "Ditolak" : "Perbaikan",
    };

    if (approved) {
      if (Array.isArray(payload.picEmails) && payload.picEmails.length > 0) {
        const cleanPics = payload.picEmails.map((e: string) => e.toLowerCase().trim()).filter(Boolean);
        if (cleanPics.length > 0) {
          updateData.picEmails = JSON.stringify(cleanPics);
          updateData.ownerEmail = cleanPics[0];
        }
      }
      if (payload.deadline) {
        updateData.deadline = payload.deadline;
        updateData.due = payload.deadline;
      }
      if (payload.priority) {
        updateData.priority = payload.priority;
      }
    }

    await getDb().update(tasks).set(updateData).where(eq(tasks.id,payload.id));
    const [task]=await getDb().select().from(tasks).where(eq(tasks.id,payload.id)).limit(1);
    await logSecurityEvent(request,{actorEmail:user.email,actorRole:user.role,action:`TASK_APPROVAL_${String(payload.action).toUpperCase()}`,resourceType:"task",resourceId:payload.id,reason:note,before,after:task});
    return Response.json({task});
  }
  if(["verify_complete","verify_revision"].includes(payload.action||"")){
    const allEmployees=await getDb().select().from(employees);
    const scope=await resolveTaskAccessScope(user,allEmployees);
    const allowed=canUserApproveTask(before,user.email,scope);
    if(!allowed)return Response.json({error:"Hanya atasan langsung PIC/pimpinan yang dapat memverifikasi hasil akhir"},{status:403});
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
  const rawProgress = Number(payload.progress);
  if (isNaN(rawProgress)) return Response.json({ error: "Nilai progress tidak valid" }, { status: 400 });
  const progress = Math.max(0, Math.min(100, Math.round(rawProgress)));
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
