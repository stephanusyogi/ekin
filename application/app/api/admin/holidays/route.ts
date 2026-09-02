import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { holidays } from "../../../../db/schema";
import { requireAdmin } from "../../../lib/access";
import { logSecurityEvent } from "../../../lib/security";

export async function GET(request:Request) { try{await requireAdmin(request);return Response.json({ holidays: await getDb().select().from(holidays).orderBy(asc(holidays.holidayDate)).limit(100) })}catch{return Response.json({error:"Akses Admin diperlukan"},{status:403})} }

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request);
    const p = await request.json() as { date?: string; title?: string; description?: string };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date || "") || !p.title?.trim()) return Response.json({ error: "Tanggal dan nama hari libur wajib diisi" }, { status: 400 });
    const [existing] = await getDb().select().from(holidays).where(eq(holidays.holidayDate, p.date!)).limit(1);
    if (existing) {
      await getDb().update(holidays).set({ title: p.title.trim(), description: p.description?.trim() || "", createdBy: admin.email }).where(eq(holidays.holidayDate, p.date!));
    } else {
      await getDb().insert(holidays).values({ holidayDate: p.date!, title: p.title.trim(), description: p.description?.trim() || "", createdBy: admin.email });
    }
    const [holiday] = await getDb().select().from(holidays).where(eq(holidays.holidayDate, p.date!)).limit(1);
    await logSecurityEvent(request,{actorEmail:admin.email,actorRole:admin.role,action:"UPSERT",resourceType:"holiday",resourceId:holiday.id,after:holiday});
    return Response.json({ holiday }, { status: 201 });
  } catch { return Response.json({ error: "Akses Admin diperlukan" }, { status: 403 }); }
}

export async function DELETE(request: Request) { try { const admin=await requireAdmin(request); const id = Number(new URL(request.url).searchParams.get("id")); if (!id) return Response.json({ error: "ID tidak valid" }, { status: 400 });const [before]=await getDb().select().from(holidays).where(eq(holidays.id,id)).limit(1); await getDb().delete(holidays).where(eq(holidays.id, id));await logSecurityEvent(request,{actorEmail:admin.email,actorRole:admin.role,action:"DELETE",resourceType:"holiday",resourceId:id,before}); return Response.json({ success: true }); } catch { return Response.json({ error: "Akses Admin diperlukan" }, { status: 403 }); } }
