import { and, asc, eq, gte, lte } from "drizzle-orm";
import { getDb } from "../../../../db";
import { attendanceAuditLogs, holidays, otherAttendances } from "../../../../db/schema";
import { requireEmployee } from "../../../lib/access";

const validDate = (value?: string) => /^\d{4}-\d{2}-\d{2}$/.test(value || "");
const calendarDays = (start: string, end: string) => Math.floor((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000) + 1;
const workingDays = (start: string, end: string, holidayDates: Set<string>) => {
  let count = 0; const cursor = new Date(`${start}T00:00:00Z`); const last = new Date(`${end}T00:00:00Z`);
  while (cursor <= last) { const date = cursor.toISOString().slice(0,10); const day = cursor.getUTCDay(); if (day !== 0 && day !== 6 && !holidayDates.has(date)) count++; cursor.setUTCDate(cursor.getUTCDate() + 1); }
  return count;
};

export async function GET(request: Request) {
  const url = new URL(request.url); const identity = await requireEmployee(request); const db = getDb();
  const from = url.searchParams.get("from") || "2000-01-01"; const to = url.searchParams.get("to") || "2999-12-31";
  const rows = await db.select().from(otherAttendances).where(and(eq(otherAttendances.employeeEmail, identity.email), lte(otherAttendances.startDate, to), gte(otherAttendances.endDate, from))).orderBy(asc(otherAttendances.startDate));
  return Response.json({ records: rows });
}

export async function POST(request: Request) {
  const identity = await requireEmployee(request); const p = await request.json() as { type?: "DL"|"Cuti"; startDate?: string; endDate?: string; documentNumber?: string; documentDate?: string; leaveType?: string; destination?: string; purpose?: string; notes?: string };
  const type = p.type === "Cuti" ? "Cuti" : "DL"; const employeeEmail = identity.email;
  const startDate = p.startDate || ""; const endDate = p.endDate || "";
  if (!employeeEmail || !validDate(startDate) || !validDate(endDate)) return Response.json({ error: "Tanggal mulai dan tanggal selesai wajib diisi" }, { status: 400 });
  if (endDate < startDate) return Response.json({ error: "Tanggal selesai tidak boleh sebelum tanggal mulai" }, { status: 400 });
  if (!p.documentNumber?.trim() || !validDate(p.documentDate)) return Response.json({ error: type === "DL" ? "Nomor dan tanggal surat tugas wajib diisi" : "Nomor dan tanggal izin tertulis wajib diisi" }, { status: 400 });
  if (type === "DL" && (!p.destination?.trim() || !p.purpose?.trim())) return Response.json({ error: "Tempat dan tujuan DL wajib diisi" }, { status: 400 });
  if (type === "Cuti" && (!p.leaveType?.trim() || !p.notes?.trim())) return Response.json({ error: "Jenis dan keterangan cuti wajib diisi" }, { status: 400 });
  const holidayRows = type === "Cuti" ? await getDb().select({ date: holidays.holidayDate }).from(holidays).where(and(gte(holidays.holidayDate, startDate), lte(holidays.holidayDate, endDate))) : [];
  const durationDays = type === "DL" ? calendarDays(startDate, endDate) : workingDays(startDate, endDate, new Set(holidayRows.map(h => h.date)));
  if (durationDays < 1) return Response.json({ error: "Rentang cuti tidak memiliki hari kerja" }, { status: 400 });
  const values = { employeeEmail, type, startDate, endDate, durationDays, documentNumber: p.documentNumber.trim(), documentDate: p.documentDate!, leaveType: p.leaveType?.trim() || "", destination: p.destination?.trim() || "", purpose: p.purpose?.trim() || "", notes: p.notes?.trim() || "", createdBy: identity.email };
  const [res] = await getDb().insert(otherAttendances).values(values);
  const [record] = await getDb().select().from(otherAttendances).where(eq(otherAttendances.id, res.insertId)).limit(1);
  await getDb().insert(attendanceAuditLogs).values({ employeeEmail, action: type === "DL" ? "create_dl" : "create_leave", workDate: startDate, detail: `${durationDays} hari sampai ${values.endDate}`, actorEmail: identity.email });
  return Response.json({ record }, { status: 201 });
}
