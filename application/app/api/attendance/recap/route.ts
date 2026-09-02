import { and, asc, eq, gte, lte } from "drizzle-orm";
import { getDb } from "../../../../db";
import {
  attendances,
  attendanceSettings,
  employees,
  holidays,
  otherAttendances,
} from "../../../../db/schema";
import { requireEmployee } from "../../../lib/access";
function period() {
  const now = new Date();
  const jakarta = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }),
  );
  const y = jakarta.getFullYear(),
    m = jakarta.getMonth(),
    d = jakarta.getDate();
  const end =
    d <= 20 ? new Date(Date.UTC(y, m, 20)) : new Date(Date.UTC(y, m + 1, 20));
  const start = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 1, 21),
  );
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
}
export async function GET(request: Request) {
  const url = new URL(request.url);
  const def = period();
  const from = url.searchParams.get("from") || def.from;
  const to = url.searchParams.get("to") || def.to;
  const employeeEmail = (await requireEmployee(request)).email;
  const db = getDb();
  const records = await db
    .select()
    .from(attendances)
    .where(
      and(
        eq(attendances.employeeEmail, employeeEmail),
        eq(attendances.isHoliday, false),
        gte(attendances.workDate, from),
        lte(attendances.workDate, to),
      ),
    )
    .orderBy(asc(attendances.workDate));
  const holidayAttendance = await db
    .select()
    .from(attendances)
    .where(
      and(
        eq(attendances.employeeEmail, employeeEmail),
        eq(attendances.isHoliday, true),
        gte(attendances.workDate, from),
        lte(attendances.workDate, to),
      ),
    )
    .orderBy(asc(attendances.workDate));
  const calendarHolidays = await db
    .select()
    .from(holidays)
    .where(and(gte(holidays.holidayDate, from), lte(holidays.holidayDate, to)))
    .orderBy(asc(holidays.holidayDate));
  const otherRecords = await db
    .select()
    .from(otherAttendances)
    .where(
      and(
        eq(otherAttendances.employeeEmail, employeeEmail),
        lte(otherAttendances.startDate, to),
        gte(otherAttendances.endDate, from),
      ),
    )
    .orderBy(asc(otherAttendances.startDate));
  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.email, employeeEmail))
    .limit(1);
  const [supervisor] = employee?.directSupervisorId
    ? await db
        .select()
        .from(employees)
        .where(eq(employees.id, employee.directSupervisorId))
        .limit(1)
    : [];
  const [settings] = await db
    .select()
    .from(attendanceSettings)
    .where(eq(attendanceSettings.id, 1))
    .limit(1);
  return Response.json({
    period: { from, to },
    printSettings: {
      header: settings?.printHeader || "",
      place: settings?.printPlace || "",
    },
    employee: employee
      ? {
          fullName: employee.fullName,
          employeeNumber: employee.employeeNumber,
          position: employee.position,
          unit: employee.unitSubsection,
        }
      : null,
    supervisor: supervisor
      ? {
          fullName: supervisor.fullName,
          employeeNumber: supervisor.employeeNumber,
          position: supervisor.position,
        }
      : null,
    regularRecap: records,
    otherRecords,
    holidayRecap: { calendarHolidays, attendanceLogs: holidayAttendance },
  });
}
