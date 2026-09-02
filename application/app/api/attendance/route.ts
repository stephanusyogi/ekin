import { and, desc, eq, gte, lte } from "drizzle-orm";
import { getDb } from "../../../db";
import { attendances, attendanceAuditLogs, attendanceReopenRequests, attendanceSettings, holidays, otherAttendances } from "../../../db/schema";
import { requireEmployee } from "../../lib/access";

const ZONE = "Asia/Jakarta";
function jakartaNow() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", weekday: "short" }).formatToParts(new Date());
  const get = (type: string) => parts.find(p => p.type === type)?.value || "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}`, weekday: get("weekday") };
}
function minutes(time: string) { const [h,m] = time.split(":").map(Number); return h * 60 + m; }
async function context() {
  const db = getDb(); const now = jakartaNow();
  let [settings] = await db.select().from(attendanceSettings).where(eq(attendanceSettings.id, 1)).limit(1);
  if (!settings) {
    await db.insert(attendanceSettings).values({ id: 1 });
    [settings] = await db.select().from(attendanceSettings).where(eq(attendanceSettings.id, 1)).limit(1);
  }
  const [holiday] = await db.select().from(holidays).where(eq(holidays.holidayDate, now.date)).limit(1);
  const weekend = now.weekday === "Sat" || now.weekday === "Sun"; const friday = now.weekday === "Fri";
  return { db, now, settings, holiday, isHoliday: weekend || Boolean(holiday), friday, workStart: friday ? settings.fridayStart : settings.mondayThursdayStart, workEnd: friday ? settings.fridayEnd : settings.mondayThursdayEnd };
}
async function getAttendance(request: Request) {
  const employeeEmail = (await requireEmployee(request)).email;
  const ctx = await context();
  const [attendance] = await ctx.db.select().from(attendances).where(and(eq(attendances.employeeEmail, employeeEmail), eq(attendances.workDate, ctx.now.date))).limit(1);
  const [activeOther] = await ctx.db.select().from(otherAttendances).where(and(eq(otherAttendances.employeeEmail, employeeEmail), lte(otherAttendances.startDate, ctx.now.date), gte(otherAttendances.endDate, ctx.now.date))).limit(1);
  const reopenRows = await ctx.db.select().from(attendanceReopenRequests).where(and(eq(attendanceReopenRequests.employeeEmail, employeeEmail), eq(attendanceReopenRequests.workDate, ctx.now.date))).orderBy(desc(attendanceReopenRequests.id));
  const activeReopen=(type:string)=>reopenRows.find(row=>row.attendanceType===type&&row.status==="Disetujui"&&Boolean(row.openUntil)&&new Date(row.openUntil!).getTime()>Date.now());
  const reopenIn=activeReopen("Absen Masuk"),reopenOut=activeReopen("Absen Pulang"),reopen=reopenRows[0];
  const isClosed = ctx.settings.dailyCloseEnabled && minutes(ctx.now.time) > minutes(ctx.settings.dailyCloseTime) && !reopenIn&&!reopenOut;
  const checkoutOpen=ctx.friday?ctx.settings.fridayCheckOutOpen:ctx.settings.mondayThursdayCheckOutOpen;
  const pastClose=ctx.settings.dailyCloseEnabled&&minutes(ctx.now.time)>minutes(ctx.settings.dailyCloseTime);
  const canCheckIn=(!pastClose||Boolean(reopenIn))&&(!ctx.settings.checkInWindowEnabled||Boolean(reopenIn)||(minutes(ctx.now.time)>=minutes(ctx.settings.checkInOpenTime)&&minutes(ctx.now.time)<=minutes(ctx.settings.checkInCloseTime)));
  const canCheckOut=(!pastClose||Boolean(reopenOut))&&(!ctx.settings.checkOutWindowEnabled||Boolean(reopenOut)||(minutes(ctx.now.time)>=minutes(checkoutOpen)&&minutes(ctx.now.time)<=minutes(ctx.settings.checkOutCloseTime)));
  return Response.json({ attendance: attendance || null, activeOther: activeOther || null, reopen: reopen || null, schedule: { start: ctx.workStart, end: ctx.workEnd, attendanceCutoff: ctx.settings.morningCutoff, replacementMultiplier: 1, dailyCloseEnabled: ctx.settings.dailyCloseEnabled, dailyCloseTime: ctx.settings.dailyCloseTime, checkInWindowEnabled:ctx.settings.checkInWindowEnabled,checkInOpenTime:ctx.settings.checkInOpenTime,checkInCloseTime:ctx.settings.checkInCloseTime,checkOutWindowEnabled:ctx.settings.checkOutWindowEnabled,checkOutOpenTime:checkoutOpen,checkOutCloseTime:ctx.settings.checkOutCloseTime,canCheckIn,canCheckOut }, day: { isHoliday: ctx.isHoliday, holidayName: ctx.holiday?.title || (ctx.isHoliday ? "Libur akhir pekan" : null), isClosed, reopened: Boolean(reopenIn||reopenOut) } });
}
async function postAttendance(request: Request) {
  const employeeEmail = (await requireEmployee(request)).email;
  const payload = await request.json().catch(() => ({})) as { action?: "check_in" | "check_out"; workOutput?: string };
  const action = payload.action || "check_in"; const ctx = await context();
  const reopenRows = await ctx.db.select().from(attendanceReopenRequests).where(and(eq(attendanceReopenRequests.employeeEmail, employeeEmail), eq(attendanceReopenRequests.workDate, ctx.now.date))).orderBy(desc(attendanceReopenRequests.id));
  const expectedType=action==="check_in"?"Absen Masuk":"Absen Pulang";
  const reopened = reopenRows.some(row=>row.attendanceType===expectedType&&row.status==="Disetujui"&&Boolean(row.openUntil)&&new Date(row.openUntil!).getTime()>Date.now());
  if (ctx.settings.dailyCloseEnabled && minutes(ctx.now.time) > minutes(ctx.settings.dailyCloseTime) && !reopened) return Response.json({ error: "Absensi harian sudah ditutup. Ajukan pembukaan kepada atasan." }, { status: 423 });
  if(action==="check_in"&&ctx.settings.checkInWindowEnabled&&!reopened&&(minutes(ctx.now.time)<minutes(ctx.settings.checkInOpenTime)||minutes(ctx.now.time)>minutes(ctx.settings.checkInCloseTime)))return Response.json({error:`Absen Masuk hanya tersedia pukul ${ctx.settings.checkInOpenTime}–${ctx.settings.checkInCloseTime}.`},{status:423});
  const checkoutOpen=ctx.friday?ctx.settings.fridayCheckOutOpen:ctx.settings.mondayThursdayCheckOutOpen;
  if(action==="check_out"&&ctx.settings.checkOutWindowEnabled&&!reopened&&(minutes(ctx.now.time)<minutes(checkoutOpen)||minutes(ctx.now.time)>minutes(ctx.settings.checkOutCloseTime)))return Response.json({error:`Absen Pulang hanya tersedia pukul ${checkoutOpen}–${ctx.settings.checkOutCloseTime}.`},{status:423});
  const [existing] = await ctx.db.select().from(attendances).where(and(eq(attendances.employeeEmail, employeeEmail), eq(attendances.workDate, ctx.now.date))).limit(1);
  if (action === "check_out") {
    if (!existing) return Response.json({ error: "Lakukan absen masuk terlebih dahulu" }, { status: 400 });
    if (existing.checkOut) return Response.json({ attendance: existing });
    const workOutput = payload.workOutput?.trim();
    if (!workOutput) return Response.json({ error: "Output pekerjaan wajib diisi" }, { status: 400 });
    await ctx.db.update(attendances).set({ checkOut: new Date().toISOString().slice(0, 19).replace('T', ' '), workOutput }).where(eq(attendances.id, existing.id));
    const [attendance] = await ctx.db.select().from(attendances).where(eq(attendances.id, existing.id)).limit(1);
    await ctx.db.insert(attendanceAuditLogs).values({ employeeEmail, action: "check_out", workDate: ctx.now.date, detail: `Output: ${workOutput}`, actorEmail: employeeEmail });
    return Response.json({ attendance });
  }
  if (existing) return Response.json({ attendance: existing });
  const [activeOther] = await ctx.db.select().from(otherAttendances).where(and(eq(otherAttendances.employeeEmail, employeeEmail), lte(otherAttendances.startDate, ctx.now.date), gte(otherAttendances.endDate, ctx.now.date))).limit(1);
  if (activeOther) return Response.json({ error: `Hari ini sudah tercatat sebagai ${activeOther.type}` }, { status: 409 });
  const lateMinutes = Math.max(0, minutes(ctx.now.time) - minutes(ctx.workStart));
  const withinAttendanceLimit = minutes(ctx.now.time) <= minutes(ctx.settings.morningCutoff);
  const attendanceStatus = ctx.isHoliday ? "holiday_recorded" : !withinAttendanceLimit ? "absent_late" : lateMinutes > 0 ? "late" : "on_time";
  const [res] = await ctx.db.insert(attendances).values({ employeeEmail, workDate: ctx.now.date, checkIn: new Date().toISOString().slice(0, 19).replace('T', ' '), attendanceStatus, lateMinutes, replacementMinutes: withinAttendanceLimit ? lateMinutes : 0, morningSession: withinAttendanceLimit, isHoliday: ctx.isHoliday });
  const [attendance] = await ctx.db.select().from(attendances).where(eq(attendances.id, res.insertId)).limit(1);
  await ctx.db.insert(attendanceAuditLogs).values({ employeeEmail, action: "check_in", workDate: ctx.now.date, detail: `Status: ${attendanceStatus}; terlambat: ${lateMinutes} menit`, actorEmail: employeeEmail });
  return Response.json({ attendance }, { status: 201 });
}

function attendanceError(error: unknown) {
  const code = error instanceof Error ? error.message : "ATTENDANCE_ERROR";
  const status = ["UNAUTHENTICATED", "SESSION_REQUIRED", "SESSION_REPLACED", "SESSION_EXPIRED"].includes(code) ? 401 : code === "EMPLOYEE_REQUIRED" || code === "FORBIDDEN" ? 403 : 500;
  const message = status === 401 ? "Sesi login tidak aktif. Silakan masuk kembali." : status === 403 ? "Absensi hanya tersedia untuk pegawai aktif." : "Layanan absensi belum dapat diproses.";
  return Response.json({ error: message }, { status });
}

export async function GET(request: Request) { try { return await getAttendance(request); } catch (error) { return attendanceError(error); } }
export async function POST(request: Request) { try { return await postAttendance(request); } catch (error) { return attendanceError(error); } }
