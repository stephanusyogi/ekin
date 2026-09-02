import { desc, eq, gte } from "drizzle-orm";
import { getDb } from "../../../../db";
import { activeUserSessions, securityAuditLogs, securityBackupLogs, sessionAuditLogs } from "../../../../db/schema";
import { requireAuthorizedUser } from "../../../lib/access";
import { logSecurityEvent } from "../../../lib/security";

const allowed=["super_user","super_admin","admin"];
export async function GET(request:Request){
  try{
    const me=await requireAuthorizedUser(request);if(!allowed.includes(me.role))throw new Error("FORBIDDEN");
    const db=getDb(),isSuper=["super_user","super_admin"].includes(me.role),since24=new Date(Date.now()-86400000).toISOString().slice(0, 19).replace('T', ' '),since7=new Date(Date.now()-7*86400000).toISOString().slice(0, 19).replace('T', ' ');
    const auditQuery=isSuper?db.select().from(securityAuditLogs).orderBy(desc(securityAuditLogs.id)).limit(100):db.select().from(securityAuditLogs).where(eq(securityAuditLogs.actorEmail,me.email)).orderBy(desc(securityAuditLogs.id)).limit(50);
    const [audits,sessionEvents,backups,sessions,denied,changes]=await Promise.all([
      auditQuery,
      isSuper?db.select().from(sessionAuditLogs).orderBy(desc(sessionAuditLogs.id)).limit(50):db.select().from(sessionAuditLogs).where(eq(sessionAuditLogs.userEmail,me.email)).orderBy(desc(sessionAuditLogs.id)).limit(20),
      db.select().from(securityBackupLogs).orderBy(desc(securityBackupLogs.id)).limit(10),
      isSuper?db.select().from(activeUserSessions).orderBy(desc(activeUserSessions.lastActivityAt)):Promise.resolve([]),
      isSuper?db.select().from(securityAuditLogs).where(gte(securityAuditLogs.createdAt,since24)):Promise.resolve([]),
      isSuper?db.select().from(securityAuditLogs).where(gte(securityAuditLogs.createdAt,since7)):Promise.resolve([]),
    ]);
    return Response.json({scope:isSuper?"Seluruh sistem":"Aktivitas administratif Anda",canRevoke:isSuper,canExport:isSuper,metrics:{activeSessions:sessions.length,denied24h:denied.filter(x=>x.status==="DITOLAK").length,changes7d:changes.filter(x=>x.status==="BERHASIL").length,lastBackup:backups[0]?.createdAt||null},sessions:sessions.map(x=>({email:x.userEmail,createdAt:x.createdAt,lastActivityAt:x.lastActivityAt,expiresAt:x.expiresAt,device:deviceName(x.userAgent),ipMasked:maskIp(x.ipAddress)})),audits,sessionEvents,backups});
  }catch{return Response.json({error:"Akses keamanan Admin diperlukan"},{status:403});}
}

export async function DELETE(request:Request){
  try{const me=await requireAuthorizedUser(request);if(!["super_user","super_admin"].includes(me.role))throw new Error("FORBIDDEN");const email=(new URL(request.url).searchParams.get("email")||"").toLowerCase();if(!email)return Response.json({error:"Akun tidak valid"},{status:400});await getDb().delete(activeUserSessions).where(eq(activeUserSessions.userEmail,email));await logSecurityEvent(request,{actorEmail:me.email,actorRole:me.role,action:"REVOKE_SESSION",resourceType:"session",resourceId:email,reason:"Dicabut melalui Dashboard Keamanan"});return Response.json({success:true});}catch{return Response.json({error:"Sesi belum dapat dicabut"},{status:403});}
}

const deviceName=(ua:string)=>/Android/i.test(ua)?"Android":/iPhone|iPad/i.test(ua)?"iPhone/iPad":/Windows/i.test(ua)?"Windows":/Macintosh/i.test(ua)?"Mac":"Perangkat lain";
const maskIp=(ip:string)=>ip.includes(":")?`${ip.split(":").slice(0,2).join(":")}:…`:ip.split(".").map((x,i)=>i>1?"x":x).join(".");
