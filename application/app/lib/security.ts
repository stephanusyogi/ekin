import { and, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { securityAuditLogs, securityRateLimits } from "../../db/schema";

type AuditInput={actorEmail?:string;actorRole?:string;action:string;resourceType:string;resourceId?:string|number;status?:"BERHASIL"|"DITOLAK"|"GAGAL";reason?:string;before?:unknown;after?:unknown};

const safeJson=(value:unknown)=>{if(value===undefined||value===null)return"";try{return JSON.stringify(value).slice(0,12000)}catch{return"[data tidak dapat diserialisasi]"}};
export const requestIp=(request:Request)=>request.headers.get("cf-connecting-ip")||request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"";

export async function logSecurityEvent(request:Request,input:AuditInput){
  try{await getDb().insert(securityAuditLogs).values({actorEmail:(input.actorEmail||"anonymous").toLowerCase(),actorRole:input.actorRole||"unknown",action:input.action,resourceType:input.resourceType,resourceId:String(input.resourceId||""),status:input.status||"BERHASIL",reason:(input.reason||"").slice(0,1000),beforeData:safeJson(input.before),afterData:safeJson(input.after),ipAddress:requestIp(request),userAgent:(request.headers.get("user-agent")||"").slice(0,500)})}catch{}
}

export function assertSameOriginMutation(request:Request){
  if(["GET","HEAD","OPTIONS"].includes(request.method.toUpperCase()))return;
  const site=request.headers.get("sec-fetch-site");if(site&&!["same-origin","same-site","none"].includes(site))throw new Error("CSRF_BLOCKED");
  const origin=request.headers.get("origin");if(origin){const target=new URL(request.url);let source:URL;try{source=new URL(origin)}catch{throw new Error("CSRF_BLOCKED")};if(source.host!==target.host)throw new Error("CSRF_BLOCKED");}
}

export async function enforceRateLimit(request:Request,action:string,identity:string,maxRequests=10,windowMinutes=15){
  const db=getDb(),key=(identity||requestIp(request)||"unknown").toLowerCase(),now=Date.now(),windowMs=windowMinutes*60000;
  const [row]=await db.select().from(securityRateLimits).where(and(eq(securityRateLimits.identityKey,key),eq(securityRateLimits.action,action))).limit(1);
  if(!row||now-Date.parse(row.windowStart)>=windowMs){if(row)await db.update(securityRateLimits).set({windowStart:new Date(now).toISOString().slice(0, 19).replace('T', ' '),requestCount:1,updatedAt:new Date(now).toISOString().slice(0, 19).replace('T', ' ')}).where(eq(securityRateLimits.id,row.id));else await db.insert(securityRateLimits).values({identityKey:key,action,windowStart:new Date(now).toISOString().slice(0, 19).replace('T', ' '),requestCount:1});return;}
  if(row.requestCount>=maxRequests){await logSecurityEvent(request,{actorEmail:identity,action:"RATE_LIMIT",resourceType:"security",status:"DITOLAK",reason:`${action}: batas ${maxRequests}/${windowMinutes} menit`});throw new Error("RATE_LIMITED");}
  await db.update(securityRateLimits).set({requestCount:row.requestCount+1,updatedAt:new Date(now).toISOString().slice(0, 19).replace('T', ' ')}).where(eq(securityRateLimits.id,row.id));
}

export function cleanEvidenceLinks(value:unknown){
  const values=(Array.isArray(value)?value:String(value||"").split(/\n|,/)).map(x=>String(x).trim()).filter(Boolean).slice(0,10);
  return values.map(raw=>{if(raw.length>2048)throw new Error("INVALID_EVIDENCE_LINK");let url:URL;try{url=new URL(raw)}catch{throw new Error("INVALID_EVIDENCE_LINK")};if(url.protocol!=="https:")throw new Error("INVALID_EVIDENCE_LINK");url.username="";url.password="";return url.toString()});
}
