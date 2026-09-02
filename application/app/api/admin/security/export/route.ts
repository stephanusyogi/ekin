import { getDb } from "../../../../../db";
import { actionPlans, activityAgendas, annualWorkPlans, attendanceAuditLogs, attendanceReopenRequests, attendanceSettings, attendances, employees, holidays, organizationCoordinations, organizationPositions, organizationUnits, otherAttendances, performanceAgreements, performanceBudgets, performanceEvaluations, performanceIndicators, recurringTaskTemplates, securityBackupLogs, taskProgressUpdates, tasks } from "../../../../../db/schema";
import { requireSuperAdmin } from "../../../../lib/access";
import { logSecurityEvent } from "../../../../lib/security";

export async function GET(request:Request){
  try{
    const me=await requireSuperAdmin(request),db=getDb();
    const [pegawai,struktur,posisiOrganisasi,koordinasi,pengaturanAbsensi,hariLibur,absensi,absensiLain,pembukaanAbsensi,auditAbsensi,todo,riwayatProgressTodo,templateTodo,agenda,rkt,rencanaAksi,pk,indikatorPk,anggaran,monev]=await Promise.all([
      db.select().from(employees),db.select().from(organizationUnits),db.select().from(organizationPositions),db.select().from(organizationCoordinations),db.select().from(attendanceSettings),db.select().from(holidays),db.select().from(attendances),db.select().from(otherAttendances),db.select().from(attendanceReopenRequests),db.select().from(attendanceAuditLogs),db.select().from(tasks),db.select().from(taskProgressUpdates),db.select().from(recurringTaskTemplates),db.select().from(activityAgendas),db.select().from(annualWorkPlans),db.select().from(actionPlans),db.select().from(performanceAgreements),db.select().from(performanceIndicators),db.select().from(performanceBudgets),db.select().from(performanceEvaluations),
    ]);
    const data={metadata:{application:"e Kinerja",formatVersion:2,exportedAt:new Date().toISOString().slice(0, 19).replace('T', ' '),exportedBy:me.email},data:{pegawai,struktur,posisiOrganisasi,koordinasi,pengaturanAbsensi,hariLibur,absensi,absensiLain,pembukaanAbsensi,auditAbsensi,todo,riwayatProgressTodo,templateTodo,agenda,rkt,rencanaAksi,pk,indikatorPk,anggaran,monev}},recordCount=Object.values(data.data).reduce((n,rows)=>n+rows.length,0);
    await db.insert(securityBackupLogs).values({requestedBy:me.email,backupType:"JSON_MANUAL",recordCount,status:"BERHASIL",notes:"Ekspor manual melalui Dashboard Keamanan"});
    await logSecurityEvent(request,{actorEmail:me.email,actorRole:me.role,action:"EXPORT_BACKUP",resourceType:"backup",after:{recordCount}});
    return new Response(JSON.stringify(data,null,2),{headers:{"content-type":"application/json; charset=utf-8","content-disposition":`attachment; filename="e-kinerja-backup-${new Date().toISOString().slice(0,10)}.json"`,"cache-control":"no-store"}});
  }catch{return Response.json({error:"Backup hanya dapat dibuat Super User/Super Admin"},{status:403});}
}
