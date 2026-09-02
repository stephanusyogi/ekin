import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { activityAgendas, employees } from "../../../db/schema";
import { requireAuthorizedUser } from "../../lib/access";
import { logSecurityEvent } from "../../lib/security";

const statuses=["Akan Berjalan","Berjalan","Selesai","Batal","Dijadwalkan Ulang"];
async function context(request:Request){const user=await requireAuthorizedUser(request),[employee]=await getDb().select().from(employees).where(eq(employees.email,user.email)).limit(1),superRole=["super_user","super_admin"].includes(user.role);return{user,employee,canManage:superRole||user.role==="editor",superRole}}

export async function GET(request:Request){const ctx=await context(request),rows=await getDb().select().from(activityAgendas).orderBy(asc(activityAgendas.startDate),asc(activityAgendas.startTime));return Response.json({agendas:rows,canManage:ctx.canManage,managedUnit:ctx.superRole?"":ctx.employee?.unitSubsection||""})}

export async function POST(request:Request){
  const ctx=await context(request);if(!ctx.canManage)return Response.json({error:"CRUD Agenda hanya untuk Editor/Kasubag"},{status:403});
  const p=await request.json() as Record<string,unknown>,title=String(p.title||"").trim(),startDate=String(p.startDate||""),unit=ctx.superRole?String(p.unit||"").trim():ctx.employee?.unitSubsection||"";
  if(!title||!startDate||!unit)return Response.json({error:"Nama, tanggal, dan unit wajib diisi"},{status:400});
  const [res]=await getDb().insert(activityAgendas).values({title,startDate,endDate:String(p.endDate||startDate),startTime:String(p.startTime||""),endTime:String(p.endTime||""),location:String(p.location||"").trim(),unit,personInCharge:String(p.personInCharge||"").trim(),description:String(p.description||"").trim(),status:statuses.includes(String(p.status))?String(p.status):"Akan Berjalan",rescheduledDate:String(p.rescheduledDate||""),notes:String(p.notes||"").trim(),createdBy:ctx.user.email});
  const [agenda]=await getDb().select().from(activityAgendas).where(eq(activityAgendas.id,res.insertId)).limit(1);
  await logSecurityEvent(request,{actorEmail:ctx.user.email,actorRole:ctx.user.role,action:"CREATE",resourceType:"activity_agenda",resourceId:agenda.id,after:agenda});
  return Response.json({agenda},{status:201})
}

export async function PATCH(request:Request){
  const ctx=await context(request);if(!ctx.canManage)return Response.json({error:"CRUD Agenda hanya untuk Editor/Kasubag"},{status:403});
  const p=await request.json() as Record<string,unknown>,id=Number(p.id);if(!id)return Response.json({error:"Agenda tidak ditemukan"},{status:400});
  const [before]=await getDb().select().from(activityAgendas).where(eq(activityAgendas.id,id)).limit(1);
  if(!before||(!ctx.superRole&&before.unit!==ctx.employee?.unitSubsection))return Response.json({error:"Agenda di luar kewenangan Anda"},{status:403});
  await getDb().update(activityAgendas).set({title:String(p.title||before.title).trim(),startDate:String(p.startDate||before.startDate),endDate:String(p.endDate||p.startDate||before.endDate),startTime:String(p.startTime??before.startTime),endTime:String(p.endTime??before.endTime),location:String(p.location??before.location).trim(),unit:ctx.superRole?String(p.unit||before.unit).trim():before.unit,personInCharge:String(p.personInCharge??before.personInCharge).trim(),description:String(p.description??before.description).trim(),status:statuses.includes(String(p.status))?String(p.status):before.status,rescheduledDate:String(p.rescheduledDate??before.rescheduledDate),notes:String(p.notes??before.notes).trim(),updatedAt:new Date().toISOString().slice(0, 19).replace('T', ' ')}).where(eq(activityAgendas.id,id));
  const [agenda]=await getDb().select().from(activityAgendas).where(eq(activityAgendas.id,id)).limit(1);
  await logSecurityEvent(request,{actorEmail:ctx.user.email,actorRole:ctx.user.role,action:"UPDATE",resourceType:"activity_agenda",resourceId:id,before,after:agenda});
  return Response.json({agenda})
}

export async function DELETE(request:Request){const ctx=await context(request);if(!ctx.canManage)return Response.json({error:"CRUD Agenda hanya untuk Editor/Kasubag"},{status:403});const id=Number(new URL(request.url).searchParams.get("id")),[before]=await getDb().select().from(activityAgendas).where(eq(activityAgendas.id,id)).limit(1);if(!before||(!ctx.superRole&&before.unit!==ctx.employee?.unitSubsection))return Response.json({error:"Agenda di luar kewenangan Anda"},{status:403});await getDb().delete(activityAgendas).where(eq(activityAgendas.id,id));await logSecurityEvent(request,{actorEmail:ctx.user.email,actorRole:ctx.user.role,action:"DELETE",resourceType:"activity_agenda",resourceId:id,before});return Response.json({success:true})}
