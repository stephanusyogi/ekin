import { and, asc, eq, gte, lte } from "drizzle-orm";
import { getDb, getPool } from "../../../../db";
import { attendances, dailyActivities, employees } from "../../../../db/schema";
import { requireAuthorizedUser, requireEmployee } from "../../../lib/access";

let tableInitialized = false;
async function ensureActivitiesTable() {
  if (tableInitialized) return;
  try {
    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS daily_activities (
        id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
        employee_email varchar(255) NOT NULL,
        activity_date varchar(10) NOT NULL,
        start_time varchar(5) NOT NULL,
        end_time varchar(5) NOT NULL,
        title varchar(500) NOT NULL,
        description text NOT NULL,
        output varchar(255) NOT NULL DEFAULT '',
        category varchar(100) NOT NULL DEFAULT 'Tugas Utama',
        location varchar(255) NOT NULL DEFAULT 'Kantor Utama',
        color varchar(50) NOT NULL DEFAULT '#10b981',
        notes text NOT NULL,
        evidence_links text NOT NULL DEFAULT '',
        created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_daily_act_emp_date (employee_email, activity_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    try {
      await pool.query(`ALTER TABLE daily_activities ADD COLUMN evidence_links text NOT NULL DEFAULT ''`);
    } catch {
      // Column already exists
    }
    tableInitialized = true;
  } catch (err) {
    console.warn("daily_activities table check:", err);
  }
}

function parseAndCleanLinks(val: unknown): string[] {
  if (!val) return [];
  let rawList: any[] = [];
  if (Array.isArray(val)) {
    rawList = val;
  } else if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      rawList = Array.isArray(parsed) ? parsed : [val];
    } catch {
      rawList = val.split(/\r?\n|,/);
    }
  }
  return rawList
    .map((s) => String(s || "").trim())
    .filter(Boolean)
    .map((raw) => {
      let candidate = raw;
      if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//i.test(candidate)) {
        candidate = "https://" + candidate;
      }
      return candidate;
    })
    .slice(0, 20);
}

function formatActivityOutput(r: any) {
  if (!r) return r;
  let parsedLinks = parseAndCleanLinks(r.evidenceLinks);
  let notes = r.notes || "";
  // Backward compatibility: if evidenceLinks is empty, but notes has URL(s)
  if (parsedLinks.length === 0 && notes) {
    const urlMatches = notes.match(/https?:\/\/[^\s]+/g);
    if (urlMatches && urlMatches.length > 0) {
      parsedLinks = urlMatches.map((u) => u.trim());
      const cleanedNotes = notes.replace(/https?:\/\/[^\s]+/g, "").trim();
      notes = cleanedNotes;
    }
  }
  return {
    ...r,
    notes,
    evidenceLinks: parsedLinks,
  };
}

async function syncToAttendance(db: ReturnType<typeof getDb>, email: string, date: string) {
  try {
    const [att] = await db
      .select()
      .from(attendances)
      .where(and(eq(attendances.employeeEmail, email), eq(attendances.workDate, date)))
      .limit(1);
    if (!att) return;
    const items = await db
      .select()
      .from(dailyActivities)
      .where(and(eq(dailyActivities.employeeEmail, email), eq(dailyActivities.activityDate, date)))
      .orderBy(asc(dailyActivities.startTime));
    const summary = items
      .map(
        (it, idx) =>
          `${idx + 1}. [${it.startTime}–${it.endTime}] ${it.title}${
            it.output ? ` (Output: ${it.output})` : ""
          }`,
      )
      .join("\n");
    await db.update(attendances).set({ workOutput: summary }).where(eq(attendances.id, att.id));
  } catch (e) {
    console.warn("syncToAttendance warning:", e);
  }
}

const ZONE = "Asia/Jakarta";
function todayJakarta(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export async function GET(request: Request) {
  try {
    await ensureActivitiesTable();
    const user = await requireAuthorizedUser(request);
    const url = new URL(request.url);
    const db = getDb();

    // Check target email (subordinate check for managers/admins)
    const targetEmail = url.searchParams.get("email") || user.email;
    if (targetEmail.toLowerCase() !== user.email.toLowerCase()) {
      const isSuper = ["super_user", "super_admin", "admin"].includes(user.role);
      const [self] = await db
        .select()
        .from(employees)
        .where(eq(employees.email, user.email))
        .limit(1);
      const isSekretaris = self?.position?.trim().toLowerCase() === "sekretaris";
      const [targetEmp] = await db
        .select()
        .from(employees)
        .where(eq(employees.email, targetEmail))
        .limit(1);
      const isSupervisor = Boolean(
        self && targetEmp && targetEmp.directSupervisorId === self.id,
      );
      if (!isSuper && !isSekretaris && !isSupervisor) {
        return Response.json({ error: "Akses ditolak" }, { status: 403 });
      }
    }

    const date = url.searchParams.get("date");
    const from = url.searchParams.get("from") || date || todayJakarta();
    const to = url.searchParams.get("to") || date || from;

    let rows: (typeof dailyActivities.$inferSelect)[] = [];
    try {
      rows = await db
        .select()
        .from(dailyActivities)
        .where(
          and(
            eq(dailyActivities.employeeEmail, targetEmail),
            gte(dailyActivities.activityDate, from),
            lte(dailyActivities.activityDate, to),
          ),
        )
        .orderBy(asc(dailyActivities.activityDate), asc(dailyActivities.startTime));
    } catch {
      rows = [];
    }

    return Response.json({ activities: rows.map(formatActivityOutput), from, to });
  } catch (err: any) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Gagal memuat aktivitas" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    await ensureActivitiesTable();
    const user = await requireEmployee(request);
    const p = (await request.json().catch(() => ({}))) as Record<string, any>;

    const activityDate = String(p.activityDate || todayJakarta());
    const startTime = String(p.startTime || "08:00").trim();
    const endTime = String(p.endTime || "09:00").trim();
    const title = String(p.title || "").trim();
    const description = String(p.description || "").trim();
    const output = String(p.output || "").trim();
    const category = String(p.category || "Tugas Utama").trim();
    const location = String(p.location || "Kantor Utama").trim();
    const color = String(p.color || "#10b981").trim();
    const notes = String(p.notes || "").trim();
    const evidenceLinks = JSON.stringify(parseAndCleanLinks(p.evidenceLinks));

    if (!title) {
      return Response.json({ error: "Judul aktivitas wajib diisi" }, { status: 400 });
    }
    if (!startTime || !endTime) {
      return Response.json({ error: "Jam mulai dan jam selesai wajib diisi" }, { status: 400 });
    }

    const db = getDb();
    const [res] = await db.insert(dailyActivities).values({
      employeeEmail: user.email,
      activityDate,
      startTime,
      endTime,
      title,
      description,
      output,
      category,
      location,
      color,
      notes,
      evidenceLinks,
    });

    const [activity] = await db
      .select()
      .from(dailyActivities)
      .where(eq(dailyActivities.id, res.insertId))
      .limit(1);

    // Sync to attendances summary if attendance exists
    await syncToAttendance(db, user.email, activityDate);

    return Response.json({ activity: formatActivityOutput(activity) }, { status: 201 });
  } catch (err: any) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Gagal menyimpan aktivitas" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    await ensureActivitiesTable();
    const user = await requireAuthorizedUser(request);
    const p = (await request.json().catch(() => ({}))) as Record<string, any>;
    const id = Number(p.id);
    if (!id) return Response.json({ error: "ID aktivitas tidak valid" }, { status: 400 });

    const db = getDb();
    const [before] = await db
      .select()
      .from(dailyActivities)
      .where(eq(dailyActivities.id, id))
      .limit(1);
    if (!before) return Response.json({ error: "Aktivitas tidak ditemukan" }, { status: 404 });

    const isOwner = before.employeeEmail.toLowerCase() === user.email.toLowerCase();
    const isAdmin = ["super_user", "super_admin"].includes(user.role);
    if (!isOwner && !isAdmin) {
      return Response.json({ error: "Anda tidak berwenang mengedit aktivitas ini" }, { status: 403 });
    }

    const activityDate = String(p.activityDate || before.activityDate);
    const startTime = String(p.startTime || before.startTime).trim();
    const endTime = String(p.endTime || before.endTime).trim();
    const title = String(p.title ?? before.title).trim();
    const description = String(p.description ?? before.description).trim();
    const output = String(p.output ?? before.output).trim();
    const category = String(p.category ?? before.category).trim();
    const location = String(p.location ?? before.location).trim();
    const color = String(p.color ?? before.color).trim();
    const notes = String(p.notes ?? before.notes).trim();
    const evidenceLinks =
      p.evidenceLinks !== undefined
        ? JSON.stringify(parseAndCleanLinks(p.evidenceLinks))
        : before.evidenceLinks;

    if (!title) {
      return Response.json({ error: "Judul aktivitas tidak boleh kosong" }, { status: 400 });
    }

    await db
      .update(dailyActivities)
      .set({
        activityDate,
        startTime,
        endTime,
        title,
        description,
        output,
        category,
        location,
        color,
        notes,
        evidenceLinks,
        updatedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
      })
      .where(eq(dailyActivities.id, id));

    const [activity] = await db
      .select()
      .from(dailyActivities)
      .where(eq(dailyActivities.id, id))
      .limit(1);

    await syncToAttendance(db, before.employeeEmail, activityDate);

    return Response.json({ activity: formatActivityOutput(activity) });
  } catch (err: any) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Gagal memperbarui aktivitas" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    await ensureActivitiesTable();
    const user = await requireAuthorizedUser(request);
    const url = new URL(request.url);
    const id = Number(url.searchParams.get("id"));
    if (!id) return Response.json({ error: "ID aktivitas tidak valid" }, { status: 400 });

    const db = getDb();
    const [before] = await db
      .select()
      .from(dailyActivities)
      .where(eq(dailyActivities.id, id))
      .limit(1);
    if (!before) return Response.json({ error: "Aktivitas tidak ditemukan" }, { status: 404 });

    const isOwner = before.employeeEmail.toLowerCase() === user.email.toLowerCase();
    const isAdmin = ["super_user", "super_admin"].includes(user.role);
    if (!isOwner && !isAdmin) {
      return Response.json({ error: "Anda tidak berwenang menghapus aktivitas ini" }, { status: 403 });
    }

    await db.delete(dailyActivities).where(eq(dailyActivities.id, id));
    await syncToAttendance(db, before.employeeEmail, before.activityDate);

    return Response.json({ success: true });
  } catch (err: any) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Gagal menghapus aktivitas" },
      { status: 500 },
    );
  }
}
