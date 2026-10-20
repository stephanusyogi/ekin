import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { getDb } from "../../../../db";
import { attendances, employees } from "../../../../db/schema";
import { requireAuthorizedUser, hasAttendanceOperator } from "../../../lib/access";
const period = () => {
  const now = new Date();
  const jakarta = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const y = jakarta.getFullYear(), m = jakarta.getMonth(), d = jakarta.getDate();
  const end = d <= 20 ? new Date(Date.UTC(y, m, 20)) : new Date(Date.UTC(y, m + 1, 20));
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 1, 21));
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
};
export async function GET(request:Request){
  const db=getDb(),me=await requireAuthorizedUser(request),url=new URL(request.url),def=period(),from=url.searchParams.get("from")||def.from,to=url.searchParams.get("to")||def.to;
  const [self]=await db.select().from(employees).where(eq(employees.email,me.email)).limit(1);
  const pos=(self?.position||"").trim().toLowerCase();
  let team=[] as typeof employees.$inferSelect[];
  if(me.role==="super_user"||me.role==="super_admin"||hasAttendanceOperator(me)||pos==="sekretaris")
    team=await db.select().from(employees).orderBy(asc(employees.fullName));
  else if(pos==="ketua")
    team=(await db.select().from(employees).orderBy(asc(employees.fullName))).filter(e=>(e.position||"").trim().toLowerCase()==="anggota"||e.id===self?.id);
  else if(self)
    team=await db.select().from(employees).where(eq(employees.directSupervisorId,self.id)).orderBy(asc(employees.fullName));
  const teamWithEmail=team.filter((e):e is typeof e & {email:string}=>Boolean(e.email));
  if(!teamWithEmail.length)return Response.json({period:{from,to},employees:team,records:[]});
  const records=await db.select().from(attendances).where(and(inArray(attendances.employeeEmail,teamWithEmail.map(e=>e.email)),gte(attendances.workDate,from),lte(attendances.workDate,to))).orderBy(asc(attendances.workDate));
  return Response.json({period:{from,to},employees:team.map(e=>({id:e.id,fullName:e.fullName,email:e.email,position:e.position,unit:e.unitSubsection})),records});
}
