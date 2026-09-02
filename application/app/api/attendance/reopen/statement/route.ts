import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { attendanceReopenRequests, employees } from "../../../../../db/schema";
import { requireAuthorizedUser } from "../../../../lib/access";
import { getFile } from "../../../../lib/storage";

export async function GET(request:Request){
  const me=await requireAuthorizedUser(request),id=Number(new URL(request.url).searchParams.get("id")||0);
  if(!id)return Response.json({error:"Dokumen tidak ditemukan"},{status:404});
  const db=getDb(),[row]=await db.select().from(attendanceReopenRequests).where(eq(attendanceReopenRequests.id,id)).limit(1);
  if(!row?.statementFileKey)return Response.json({error:"Dokumen tidak ditemukan"},{status:404});
  const staff=await db.select().from(employees),employee=staff.find(e=>e.email?.toLowerCase()===row.employeeEmail.toLowerCase()),viewer=staff.find(e=>e.email?.toLowerCase()===me.email.toLowerCase());
  const allowed=row.employeeEmail.toLowerCase()===me.email.toLowerCase()||["super_user","super_admin"].includes(me.role)||Boolean(employee&&viewer&&employee.directSupervisorId===viewer.id);
  if(!allowed)return Response.json({error:"Anda tidak berwenang melihat dokumen ini"},{status:403});
  const buffer=await getFile(row.statementFileKey);
  if(!buffer)return Response.json({error:"Dokumen tidak ditemukan"},{status:404});
  const safeName=(row.statementFileName||"surat-pernyataan").replace(/[\r\n"]/g,"_");
  return new Response(buffer,{headers:{"content-type":row.statementFileType||"application/octet-stream","content-disposition":`inline; filename="${safeName}"`,"cache-control":"private, no-store"}});
}
