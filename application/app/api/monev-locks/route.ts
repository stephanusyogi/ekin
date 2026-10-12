import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { monevPeriodLocks } from "../../../db/schema";
import { hasSakipOperator, requireAuthorizedUser } from "../../lib/access";
import { logSecurityEvent } from "../../lib/security";

const managers = ["super_user", "super_admin", "admin"];

export async function GET(request: Request) {
  try {
    await requireAuthorizedUser(request);
    const db = getDb();
    const locks = await db.select().from(monevPeriodLocks).orderBy(asc(monevPeriodLocks.periodKey));
    return Response.json({ locks });
  } catch (error) {
    return Response.json({ error: "Gagal memuat status penguncian Monev", details: error instanceof Error ? error.message : String(error) }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    const me = await requireAuthorizedUser(request);
    const canManage = managers.includes(me.role) || hasSakipOperator(me);
    if (!canManage) {
      return Response.json({ error: "Hanya Pimpinan atau Operator SAKIP yang dapat mengubah status kunci Monev" }, { status: 403 });
    }

    const db = getDb();
    const p = await request.json() as any;
    const year = Number(p.year);
    const periodType = String(p.periodType || "Triwulanan");
    const periodKey = String(p.periodKey || "").trim();
    const isLocked = Boolean(p.isLocked);
    const notes = String(p.notes || "").trim();

    if (!year || !periodKey) {
      return Response.json({ error: "Tahun dan Periode Monev wajib diisi" }, { status: 400 });
    }

    const existing = await db.select().from(monevPeriodLocks).where(eq(monevPeriodLocks.periodKey, periodKey)).limit(1);

    if (existing.length > 0) {
      await db.update(monevPeriodLocks).set({
        isLocked,
        lockedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
        lockedBy: me.email,
        notes,
      }).where(eq(monevPeriodLocks.id, existing[0].id));
    } else {
      await db.insert(monevPeriodLocks).values({
        year,
        periodType,
        periodKey,
        isLocked,
        lockedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
        lockedBy: me.email,
        notes,
      });
    }

    const [current] = await db.select().from(monevPeriodLocks).where(eq(monevPeriodLocks.periodKey, periodKey)).limit(1);
    await logSecurityEvent(request, {
      actorEmail: me.email,
      actorRole: me.role,
      action: isLocked ? "LOCK" : "UNLOCK",
      resourceType: "monev_period_lock",
      resourceId: current?.id,
      after: current,
    });

    const locks = await db.select().from(monevPeriodLocks).orderBy(asc(monevPeriodLocks.periodKey));
    return Response.json({ success: true, lock: current, locks });
  } catch (error) {
    return Response.json({ error: "Gagal memperbarui status kunci Monev", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
