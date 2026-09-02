import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { activeUserSessions, sessionAuditLogs } from "../../../db/schema";
import { clientIp, getAuthorizedIdentity, hashSessionToken, readCookie, requireActiveSession } from "../../lib/access";
import { assertSameOriginMutation, enforceRateLimit } from "../../lib/security";

const SESSION_SECONDS=24*60*60;
const cookie=(name:string,value:string,maxAge=SESSION_SECONDS)=>`${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;

export async function POST(request:Request){
  try{
    assertSameOriginMutation(request);const user=await getAuthorizedIdentity(request);await enforceRateLimit(request,"LOGIN_SESSION",user.email,8,15);const db=getDb(),takeover=new URL(request.url).searchParams.get("takeover")==="1";
    const state=readCookie(request,"ekinerja_session_state"),oldToken=readCookie(request,"ekinerja_session"),[active]=await db.select().from(activeUserSessions).where(eq(activeUserSessions.userEmail,user.email)).limit(1);
    const userState=await hashSessionToken(user.email);
    if(state===userState&&!takeover)return replaced(userState);
    if(oldToken&&active&&active.sessionHash===await hashSessionToken(oldToken))return Response.json({ok:true,reused:true});
    if(oldToken&&active&&!takeover)return replaced(userState);
    const token=crypto.randomUUID()+crypto.randomUUID(),now=new Date(),expires=new Date(now.getTime()+SESSION_SECONDS*1000).toISOString().slice(0, 19).replace('T', ' '),ip=clientIp(request),agent=request.headers.get("user-agent")||"";
    if(active&&active.sessionHash!==await hashSessionToken(token))await db.insert(sessionAuditLogs).values({userEmail:user.email,action:"SESSION_REPLACED",ipAddress:ip,userAgent:agent,detail:"Sesi lama dicabut oleh login baru"});
    if(active){
      await db.update(activeUserSessions).set({sessionHash:await hashSessionToken(token),createdAt:now.toISOString().slice(0, 19).replace('T', ' '),lastActivityAt:now.toISOString().slice(0, 19).replace('T', ' '),expiresAt:expires,ipAddress:ip,userAgent:agent}).where(eq(activeUserSessions.userEmail,user.email));
    } else {
      await db.insert(activeUserSessions).values({userEmail:user.email,sessionHash:await hashSessionToken(token),createdAt:now.toISOString().slice(0, 19).replace('T', ' '),lastActivityAt:now.toISOString().slice(0, 19).replace('T', ' '),expiresAt:expires,ipAddress:ip,userAgent:agent});
    }
    await db.insert(sessionAuditLogs).values({userEmail:user.email,action:"LOGIN",ipAddress:ip,userAgent:agent,detail:takeover?"Pengguna mengambil alih sesi":"Login berhasil"});
    const headers=new Headers();headers.append("set-cookie",cookie("ekinerja_session",token));headers.append("set-cookie",cookie("ekinerja_session_state","",0));
    return Response.json({ok:true},{headers});
  }catch(error){const code=error instanceof Error?error.message:"";if(code==="RATE_LIMITED")return Response.json({error:"Terlalu banyak percobaan. Tunggu 15 menit lalu coba kembali.",code},{status:429});if(code==="CSRF_BLOCKED")return Response.json({error:"Permintaan lintas situs ditolak.",code},{status:403});return Response.json({error:code==="FORBIDDEN"?"Akun belum terdaftar atau dinonaktifkan":"Identitas login tidak tersedia",code},{status:code==="FORBIDDEN"?403:401});}
}

export async function GET(request:Request){try{const user=await getAuthorizedIdentity(request);await requireActiveSession(request,user.email);return Response.json({ok:true});}catch(error){const code=error instanceof Error?error.message:"";if(code.startsWith("SESSION_")){let state="replaced";try{state=await hashSessionToken((await getAuthorizedIdentity(request)).email)}catch{}return replaced(state,code);}return Response.json({error:"Sesi tidak tersedia",code},{status:401});}}

export async function DELETE(request:Request){try{const user=await getAuthorizedIdentity(request),db=getDb();await db.delete(activeUserSessions).where(eq(activeUserSessions.userEmail,user.email));await db.insert(sessionAuditLogs).values({userEmail:user.email,action:"LOGOUT",ipAddress:clientIp(request),userAgent:request.headers.get("user-agent")||"",detail:"Logout aplikasi"});const headers=new Headers();headers.append("set-cookie",cookie("ekinerja_session","",0));headers.append("set-cookie",cookie("ekinerja_session_state","",0));return Response.json({ok:true},{headers});}catch{return Response.json({ok:true});}}

function replaced(state:string,code="SESSION_REPLACED"){const headers=new Headers();headers.append("set-cookie",cookie("ekinerja_session","",0));headers.append("set-cookie",cookie("ekinerja_session_state",state));return Response.json({error:"Akun Anda telah masuk dari perangkat lain.",code},{status:409,headers});}
