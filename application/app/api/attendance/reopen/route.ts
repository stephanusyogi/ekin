import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { attendanceAuditLogs, attendanceReopenRequests, employees } from "../../../../db/schema";
import { requireAuthorizedUser, requireEmployee } from "../../../lib/access";
import { deleteFile, saveFile } from "../../../lib/storage";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone:"Asia/Jakarta", year:"numeric", month:"2-digit", day:"2-digit" }).format(new Date());
const isTopLeader=(position?:string|null)=>["ketua","sekretaris"].includes((position||"").trim().toLowerCase());

export async function GET(request: Request) {
  const team=new URL(request.url).searchParams.get("scope")==="team";
  if(team){
    const me=await requireAuthorizedUser(request),db=getDb(),staff=await db.select().from(employees),self=staff.find(e=>e.email?.toLowerCase()===me.email.toLowerCase()),direct=new Set(staff.filter(e=>e.directSupervisorId===self?.id&&e.email).map(e=>e.email!.toLowerCase())),rows=await db.select().from(attendanceReopenRequests).orderBy(desc(attendanceReopenRequests.id)).limit(100),topEmails=new Set(staff.filter(e=>isTopLeader(e.position)&&e.email).map(e=>e.email!.toLowerCase())),isSuper=["super_user","super_admin"].includes(me.role),visible=rows.filter(row=>direct.has(row.employeeEmail.toLowerCase())||(isSuper&&topEmails.has(row.employeeEmail.toLowerCase())));
    return Response.json({requests:visible.slice(0,50)})
  }
  const me=await requireEmployee(request);
  const rows=await getDb().select().from(attendanceReopenRequests).where(eq(attendanceReopenRequests.employeeEmail,me.email)).orderBy(desc(attendanceReopenRequests.id)).limit(20);
  return Response.json({ requests:rows });
}

export async function POST(request: Request) {
  const me=await requireEmployee(request);
  const form=await request.formData(),reason=String(form.get("reason")||"").trim(),attendanceType=["Absen Masuk","Absen Pulang"].includes(String(form.get("attendanceType")||""))?String(form.get("attendanceType")):"Absen Masuk",workDate=String(form.get("workDate")||today()),file=form.get("statement");
  if(!reason) return Response.json({error:"Alasan pembukaan wajib diisi"},{status:400});
  if(!/^\d{4}-\d{2}-\d{2}$/.test(workDate))return Response.json({error:"Tanggal absensi tidak valid"},{status:400});
  if(!(file instanceof File)||!file.size)return Response.json({error:"Surat pernyataan pribadi wajib dilampirkan"},{status:400});
  const allowedTypes=new Set(["application/pdf","image/jpeg","image/png"]);
  if(!allowedTypes.has(file.type))return Response.json({error:"Surat pernyataan harus berupa PDF, JPG, atau PNG"},{status:400});
  if(file.size>5*1024*1024)return Response.json({error:"Ukuran surat pernyataan maksimal 5 MB"},{status:400});
  const db=getDb(),[existing]=await db.select().from(attendanceReopenRequests).where(and(eq(attendanceReopenRequests.employeeEmail,me.email),eq(attendanceReopenRequests.workDate,workDate),eq(attendanceReopenRequests.attendanceType,attendanceType),eq(attendanceReopenRequests.status,"Menunggu"))).limit(1);
  if(existing) return Response.json({request:existing});
  const key=`attendance-statements/${me.email.toLowerCase()}/${crypto.randomUUID()}`;
  await saveFile(key, await file.arrayBuffer());
  try{
    const [res]=await db.insert(attendanceReopenRequests).values({employeeEmail:me.email,workDate,reason,attendanceType,statementFileKey:key,statementFileName:file.name,statementFileType:file.type,statementFileSize:file.size});
    const [row]=await db.select().from(attendanceReopenRequests).where(eq(attendanceReopenRequests.id, res.insertId)).limit(1);
    await db.insert(attendanceAuditLogs).values({employeeEmail:me.email,action:"request_reopen",workDate,detail:`${attendanceType}: ${reason}; surat: ${file.name}`,actorEmail:me.email});
    return Response.json({request:row},{status:201});
  }catch(error){
    await deleteFile(key);
    throw error;
  }
}

export async function PATCH(request: Request) {
  try {
    const me=await requireAuthorizedUser(request),p=await request.json() as {id?:number;decision?:"Disetujui"|"Ditolak"};
    if(!p.id||!p.decision) return Response.json({error:"Permintaan tidak valid"},{status:400});
    const db=getDb(),[requestRow]=await db.select().from(attendanceReopenRequests).where(eq(attendanceReopenRequests.id,p.id)).limit(1);
    if(!requestRow)return Response.json({error:"Permintaan tidak ditemukan"},{status:404});
    if(requestRow.status!=="Menunggu")return Response.json({error:"Permintaan ini sudah diputuskan"},{status:409});
    const staff=await db.select().from(employees),employee=staff.find(e=>e.email?.toLowerCase()===requestRow.employeeEmail.toLowerCase()),approver=staff.find(e=>e.email?.toLowerCase()===me.email.toLowerCase()),allowed=isTopLeader(employee?.position)?["super_user","super_admin"].includes(me.role):Boolean(employee&&approver&&employee.directSupervisorId===approver.id);
    if(!allowed)return Response.json({error:isTopLeader(employee?.position)?"Permintaan Ketua/Sekretaris hanya dapat diputuskan Super Admin":"Hanya atasan langsung yang dapat memutuskan"},{status:403});
    const now=new Date(),openUntil=p.decision==="Disetujui"?new Date(now.getTime()+60*60*1000).toISOString().slice(0, 19).replace('T', ' '):null;
    await db.update(attendanceReopenRequests).set({status:p.decision,decidedBy:me.email,decidedAt:now.toISOString().slice(0, 19).replace('T', ' '),openUntil}).where(eq(attendanceReopenRequests.id,p.id));
    const [row]=await db.select().from(attendanceReopenRequests).where(eq(attendanceReopenRequests.id,p.id)).limit(1);
    await db.insert(attendanceAuditLogs).values({employeeEmail:row.employeeEmail,action:p.decision==="Disetujui"?"approve_reopen":"reject_reopen",workDate:row.workDate,detail:openUntil?`${row.attendanceType} terbuka sampai ${openUntil}`:"Ditolak",actorEmail:me.email});
    return Response.json({request:row});
  } catch {
    return Response.json({error:"Keputusan belum dapat disimpan"},{status:403});
  }
}
