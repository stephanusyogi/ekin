import { asc, gte } from "drizzle-orm";
import { getDb } from "../../../db";
import { holidays } from "../../../db/schema";
import { requireAuthorizedUser } from "../../lib/access";
function today() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
export async function GET(request:Request) { await requireAuthorizedUser(request); const rows = await getDb().select().from(holidays).where(gte(holidays.holidayDate, today())).orderBy(asc(holidays.holidayDate)).limit(10); return Response.json({ announcements: rows.map(h => ({ id: h.id, date: h.holidayDate, title: `Pengumuman Hari Libur: ${h.title}`, description: h.description })) }); }
