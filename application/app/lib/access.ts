import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { activeUserSessions, employees, sessionAuditLogs, systemAccounts } from "../../db/schema";
import { assertSameOriginMutation, enforceRateLimit, logSecurityEvent } from "./security";
import { ensureDemoDatabase } from "./demo-bootstrap";

import { verifyToken } from "./auth-utils";

export function requestIdentity(request: Request) {
  const authCookie = readCookie(request, "ekinerja_auth");
  if (authCookie) {
    const verified = verifyToken(authCookie);
    if (verified?.email) {
      return { email: verified.email.trim().toLowerCase(), name: verified.name || "Pengguna e Kinerja" };
    }
  }
  throw new Error("UNAUTHENTICATED");
}
export async function getAuthorizedIdentity(request:Request){const identity=requestIdentity(request),db=getDb();const [system]=await db.select().from(systemAccounts).where(eq(systemAccounts.email,identity.email)).limit(1);if(system?.status==="Aktif"){await ensureDemoDatabase(identity.email);return{...identity,name:system.displayName,role:"super_user" as const,isEmployee:false as const,employee:null};}const [employee]=await db.select().from(employees).where(eq(employees.email,identity.email)).limit(1);if(!employee||employee.employeeStatus!=="Aktif"||employee.accountStatus!=="Aktif")throw new Error("FORBIDDEN");return{...identity,name:employee.fullName,role:employee.accessLevel.toLowerCase().replace(" ","_") as "super_admin"|"admin"|"editor"|"user"|"viewer"|"operator",isEmployee:true as const,employee};}

export async function requireAuthorizedUser(request:Request){assertSameOriginMutation(request);try{const user=await getAuthorizedIdentity(request);await requireActiveSession(request,user.email);if(!["GET","HEAD","OPTIONS"].includes(request.method.toUpperCase())){await enforceRateLimit(request,"DATA_MUTATION",user.email,120,15);await logSecurityEvent(request,{actorEmail:user.email,actorRole:user.role,action:"MUTATION_AUTHORIZED",resourceType:"api",resourceId:new URL(request.url).pathname,reason:request.method})}return user}catch(error){const code=error instanceof Error?error.message:"ACCESS_DENIED";let email="anonymous";try{email=requestIdentity(request).email}catch{}await logSecurityEvent(request,{actorEmail:email,action:"ACCESS_CHECK",resourceType:"api",resourceId:new URL(request.url).pathname,status:"DITOLAK",reason:code});throw error;}}

export async function requireActiveSession(request:Request,email:string){
  const token=readCookie(request,"ekinerja_session");
  if(!token)throw new Error("SESSION_REQUIRED");
  const db=getDb(),hash=await hashSessionToken(token),[active]=await db.select().from(activeUserSessions).where(eq(activeUserSessions.userEmail,email)).limit(1);
  if(!active||active.sessionHash!==hash)throw new Error("SESSION_REPLACED");
  const now=Date.now();
  if(Date.parse(active.expiresAt)<=now){await db.delete(activeUserSessions).where(eq(activeUserSessions.userEmail,email));await db.insert(sessionAuditLogs).values({userEmail:email,action:"SESSION_EXPIRED",ipAddress:clientIp(request),userAgent:request.headers.get("user-agent")||"",detail:"Sesi berakhir otomatis"});throw new Error("SESSION_EXPIRED");}
  if(now-Date.parse(active.lastActivityAt)>300000)await db.update(activeUserSessions).set({lastActivityAt:new Date(now).toISOString().slice(0, 19).replace('T', ' ')}).where(eq(activeUserSessions.userEmail,email));
}

export function readCookie(request:Request,name:string){const cookie=request.headers.get("cookie")||"";for(const part of cookie.split(";")){const [key,...value]=part.trim().split("=");if(key===name)return decodeURIComponent(value.join("="));}return null;}
export async function hashSessionToken(token:string){const bytes=new TextEncoder().encode(token),digest=await crypto.subtle.digest("SHA-256",bytes);return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,"0")).join("");}
export function clientIp(request:Request){return request.headers.get("cf-connecting-ip")||request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"";}
export async function requireEmployee(request:Request){const user=await requireAuthorizedUser(request);if(!user.isEmployee)throw new Error("EMPLOYEE_REQUIRED");return user;}
export async function requireAdmin(request: Request) {
  const authorized=await requireAuthorizedUser(request); if(!["super_user","super_admin","admin"].includes(authorized.role)) throw new Error("FORBIDDEN"); return {email:authorized.email,fullName:authorized.name,role:authorized.role==="super_user"?"super_admin" as const:authorized.role,unit:authorized.isEmployee?authorized.employee.unitSubsection:"Sistem",employeeNumber:authorized.isEmployee?authorized.employee.employeeNumber:""};
}
export async function requireSuperAdmin(request: Request) {
  const authorized=await requireAuthorizedUser(request); if(!["super_user","super_admin"].includes(authorized.role)) throw new Error("FORBIDDEN"); return {email:authorized.email,role:authorized.role};
}
export const hasAttendanceOperator=(user:Awaited<ReturnType<typeof getAuthorizedIdentity>>)=>["super_user","super_admin","admin","operator"].includes(user.role)||Boolean(user.isEmployee&&user.employee.operatorAttendance);
export const hasSakipOperator=(user:Awaited<ReturnType<typeof getAuthorizedIdentity>>)=>["super_user","super_admin"].includes(user.role)||Boolean(user.isEmployee&&user.employee.operatorSakip);
export async function requireAllAttendanceReportAccess(request:Request){const user=await requireAuthorizedUser(request);if(!hasAttendanceOperator(user))throw new Error("FORBIDDEN");return user;}
