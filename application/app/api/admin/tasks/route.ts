import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { employees, organizationUnits, performanceAgreements, performanceIndicators, tasks } from "../../../../db/schema";
import { requireSuperAdmin } from "../../../lib/access";
import { logSecurityEvent } from "../../../lib/security";

type TaskInput={id?:number;title?:string;unit?:string;picEmails?:string[];priority?:string;outputType?:string;sourcePerformanceAgreementId?:number|null;sourcePerformanceIndicatorId?:number|null;deadline?:string;extendedDeadline?:string;status?:string;progress?:number;output?:string;notes?:string;verificationStatus?:string};

export async function PATCH(request:Request){
  try{
    const admin=await requireSuperAdmin(request),p=await request.json() as TaskInput;
    if(!p.id||!p.title?.trim()||!p.unit?.trim())return Response.json({error:"ID, uraian, dan unit wajib diisi"},{status:400});
    const [before]=await getDb().select().from(tasks).where(eq(tasks.id,p.id)).limit(1);
    if(!before)return Response.json({error:"To-Do tidak ditemukan"},{status:404});
    const [unit]=await getDb().select({id:organizationUnits.id}).from(organizationUnits).where(and(eq(organizationUnits.name,p.unit.trim()),eq(organizationUnits.status,"Aktif"))).limit(1);
    if(!unit)return Response.json({error:"Unit/Subbagian tidak aktif atau belum terdaftar"},{status:400});
    const activeEmployees=await getDb().select().from(employees),allowed=new Set(activeEmployees.filter(e=>e.email&&e.employeeStatus==="Aktif"&&e.accountStatus==="Aktif").map(e=>e.email!.toLowerCase())),pics=(p.picEmails||[]).map(x=>x.toLowerCase()).filter(x=>allowed.has(x));
    if(!pics.length)return Response.json({error:"Pilih minimal satu PIC aktif"},{status:400});
    const sourceAgreementId=Number(p.sourcePerformanceAgreementId||0),sourceIndicatorId=Number(p.sourcePerformanceIndicatorId||0);
    if(Boolean(sourceAgreementId)!==Boolean(sourceIndicatorId))return Response.json({error:"Sumber PK tidak lengkap"},{status:400});
    if(sourceIndicatorId){const [indicator]=await getDb().select().from(performanceIndicators).where(eq(performanceIndicators.id,sourceIndicatorId)).limit(1),[agreement]=await getDb().select().from(performanceAgreements).where(eq(performanceAgreements.id,sourceAgreementId)).limit(1);if(!indicator||!agreement||indicator.agreementId!==agreement.id)return Response.json({error:"Sumber PK tidak ditemukan"},{status:400})}
    const progress=Math.max(0,Math.min(100,Number(p.progress)||0)),verification=p.verificationStatus||"Belum Diverifikasi",status=verification==="Terverifikasi"?"Selesai":verification==="Perlu Perbaikan"?"Perbaikan":progress===100?"Verifikasi Final":p.status||"Baru";
    await getDb().update(tasks).set({title:p.title.trim(),unit:p.unit.trim(),picEmails:JSON.stringify(pics),ownerEmail:pics[0],priority:p.priority||"Sedang",outputType:p.outputType||"Dokumen",sourcePerformanceAgreementId:sourceAgreementId||null,sourcePerformanceIndicatorId:sourceIndicatorId||null,deadline:p.deadline||"",due:p.extendedDeadline||p.deadline||"Belum ditentukan",extendedDeadline:p.extendedDeadline||"",status,progress,output:p.output?.trim()||"",notes:p.notes?.trim()||"",verificationStatus:verification}).where(eq(tasks.id,p.id));
    const [task]=await getDb().select().from(tasks).where(eq(tasks.id,p.id)).limit(1);
    await logSecurityEvent(request,{actorEmail:admin.email,actorRole:admin.role,action:"UPDATE",resourceType:"task",resourceId:p.id,before,after:task});return Response.json({task});
  }catch{return Response.json({error:"Akses Super User/Super Admin diperlukan"},{status:403})}
}

export async function DELETE(request:Request){
  try{
    const admin=await requireSuperAdmin(request),url=new URL(request.url),id=Number(url.searchParams.get("id")),reason=(url.searchParams.get("reason")||"").trim();
    if(!id)return Response.json({error:"To-Do tidak ditemukan"},{status:400});
    if(reason.length<5)return Response.json({error:"Alasan penghapusan minimal 5 karakter"},{status:400});
    const [before]=await getDb().select().from(tasks).where(eq(tasks.id,id)).limit(1);
    if(!before)return Response.json({error:"To-Do tidak ditemukan"},{status:404});
    await getDb().delete(tasks).where(eq(tasks.id,id));
    await logSecurityEvent(request,{actorEmail:admin.email,actorRole:admin.role,action:"DELETE",resourceType:"task",resourceId:id,reason,before});
    return Response.json({success:true})
  }catch{return Response.json({error:"Akses Super User/Super Admin diperlukan"},{status:403})}
}
