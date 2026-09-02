import { and, asc, eq, gte, lte } from "drizzle-orm";
import { getDb } from "../../../../db";
import {
  attendances,
  attendanceSettings,
  employees,
  holidays,
  otherAttendances,
} from "../../../../db/schema";
import { requireAllAttendanceReportAccess } from "../../../lib/access";

function defaultPeriod() {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }),
  );
  const end = new Date(
    now.getFullYear(),
    now.getMonth() + (now.getDate() >= 21 ? 1 : 0),
    20,
  );
  const start = new Date(end.getFullYear(), end.getMonth() - 1, 21);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: fmt(start), to: fmt(end) };
}

export async function GET(request: Request) {
  try {
    const viewer = await requireAllAttendanceReportAccess(request);
    const url = new URL(request.url),
      fallback = defaultPeriod();
    const from = url.searchParams.get("from") || fallback.from,
      to = url.searchParams.get("to") || fallback.to;
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(to) ||
      from > to
    )
      return Response.json(
        { error: "Periode laporan tidak valid" },
        { status: 400 },
      );
    const db = getDb();
    const [staff, records, otherRecords, calendarHolidays, settingsRows] =
      await Promise.all([
        db
          .select()
          .from(employees)
          .where(eq(employees.employeeStatus, "Aktif"))
          .orderBy(asc(employees.fullName)),
        db
          .select()
          .from(attendances)
          .where(
            and(
              eq(attendances.isHoliday, false),
              gte(attendances.workDate, from),
              lte(attendances.workDate, to),
            ),
          )
          .orderBy(asc(attendances.workDate)),
        db
          .select()
          .from(otherAttendances)
          .where(
            and(
              lte(otherAttendances.startDate, to),
              gte(otherAttendances.endDate, from),
            ),
          )
          .orderBy(asc(otherAttendances.startDate)),
        db
          .select()
          .from(holidays)
          .where(
            and(gte(holidays.holidayDate, from), lte(holidays.holidayDate, to)),
          )
          .orderBy(asc(holidays.holidayDate)),
        db
          .select()
          .from(attendanceSettings)
          .where(eq(attendanceSettings.id, 1))
          .limit(1),
      ]);
    return Response.json({
      period: { from, to },
      printSettings: {
        header: settingsRows[0]?.printHeader || "",
        place: settingsRows[0]?.printPlace || "",
      },
      generatedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
      generatedBy: {
        name: viewer.name,
        email: viewer.email,
        role: viewer.role,
      },
      employees: staff.map((e) => ({
        id: e.id,
        fullName: e.fullName,
        employeeNumber: e.employeeNumber,
        email: e.email,
        position: e.position,
        unit: e.unitSubsection,
        directSupervisorId: e.directSupervisorId,
      })),
      records,
      otherRecords,
      holidays: calendarHolidays,
    });
  } catch {
    return Response.json(
      {
        error:
          "Akses laporan seluruh pegawai hanya untuk Operator dan pengelola sistem",
      },
      { status: 403 },
    );
  }
}
