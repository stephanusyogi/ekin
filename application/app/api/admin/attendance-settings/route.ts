import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { attendanceSettings } from "../../../../db/schema";
import { requireSuperAdmin } from "../../../lib/access";
import { logSecurityEvent } from "../../../lib/security";

export async function GET(request: Request) {
  try {
    await requireSuperAdmin(request);
    let [settings] = await getDb()
      .select()
      .from(attendanceSettings)
      .where(eq(attendanceSettings.id, 1))
      .limit(1);
    if (!settings) {
      await getDb().insert(attendanceSettings).values({ id: 1 });
      [settings] = await getDb()
        .select()
        .from(attendanceSettings)
        .where(eq(attendanceSettings.id, 1))
        .limit(1);
    }
    return Response.json({ settings });
  } catch {
    return Response.json(
      { error: "Akses Super Admin diperlukan" },
      { status: 403 },
    );
  }
}
export async function PATCH(request: Request) {
  try {
    const admin=await requireSuperAdmin(request);
    const [before]=await getDb().select().from(attendanceSettings).where(eq(attendanceSettings.id,1)).limit(1);
    const p = (await request.json()) as Partial<
      typeof attendanceSettings.$inferInsert
    >;
    const values = {
      mondayThursdayStart: p.mondayThursdayStart || "07:30",
      mondayThursdayEnd: p.mondayThursdayEnd || "16:00",
      fridayStart: p.fridayStart || "07:30",
      fridayEnd: p.fridayEnd || "16:30",
      graceMinutes: 0,
      replacementMultiplier: 1,
      morningCutoff: p.morningCutoff || "08:30",
      dailyCloseEnabled: Boolean(p.dailyCloseEnabled),
      dailyCloseTime: p.dailyCloseTime || "18:00",
      checkInWindowEnabled: Boolean(p.checkInWindowEnabled),
      checkInOpenTime: p.checkInOpenTime || "05:00",
      checkInCloseTime: p.checkInCloseTime || "08:30",
      checkOutWindowEnabled: Boolean(p.checkOutWindowEnabled),
      mondayThursdayCheckOutOpen: p.mondayThursdayCheckOutOpen || "16:00",
      fridayCheckOutOpen: p.fridayCheckOutOpen || "16:30",
      checkOutCloseTime: p.checkOutCloseTime || "23:59",
      printHeader: (p.printHeader || "").trim().slice(0, 500),
      printPlace: (p.printPlace || "").trim().slice(0, 100),
      updatedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
    };
    if (before) {
      await getDb().update(attendanceSettings).set(values).where(eq(attendanceSettings.id, 1));
    } else {
      await getDb().insert(attendanceSettings).values({ id: 1, ...values });
    }
    await logSecurityEvent(request,{actorEmail:admin.email,actorRole:admin.role,action:"UPDATE",resourceType:"attendance_settings",resourceId:1,before,after:values});
    return Response.json({ settings: { id: 1, ...values } });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error && error.message === "FORBIDDEN"
            ? "Akses Admin diperlukan"
            : "Pengaturan tidak valid",
      },
      { status: 403 },
    );
  }
}
