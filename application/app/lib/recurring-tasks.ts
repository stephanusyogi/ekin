import { and, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { recurringTaskTemplates, tasks } from "../../db/schema";

const iso = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (date: Date, days: number) => { const next = new Date(date); next.setUTCDate(next.getUTCDate() + days); return next; };

function periodFor(date: Date, frequency: string) {
  const year = date.getUTCFullYear(), month = date.getUTCMonth();
  if (frequency === "Mingguan") {
    const monday = addDays(date, -((date.getUTCDay() + 6) % 7));
    return { start: monday, key: `W-${iso(monday)}`, label: `Minggu ${iso(monday)}` };
  }
  if (frequency === "Bulanan") return { start: new Date(Date.UTC(year, month, 1)), key: `${year}-${String(month + 1).padStart(2, "0")}`, label: new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(date) };
  const span = frequency === "Triwulan" ? 3 : 6;
  const index = Math.floor(month / span);
  return { start: new Date(Date.UTC(year, index * span, 1)), key: `${year}-${frequency === "Triwulan" ? "T" : "S"}${index + 1}`, label: `${frequency} ${index + 1} · ${year}` };
}

export async function generateRecurringTasks(now = new Date()) {
  const db = getDb();
  const templates = await db.select().from(recurringTaskTemplates).where(eq(recurringTaskTemplates.status, "Aktif"));
  let generated = 0;
  for (const template of templates) {
    const period = periodFor(now, template.frequency);
    const generationDate = addDays(period.start, Math.max(0, template.generationDay - 1));
    const today = iso(now);
    if (today < iso(generationDate) || today < template.startDate || (template.endDate && today > template.endDate)) continue;

    const [existing] = await db.select().from(tasks).where(and(eq(tasks.recurringTemplateId, template.id), eq(tasks.recurringPeriodKey, period.key))).limit(1);
    if (existing) continue;

    const pics = JSON.parse(template.picEmails || "[]") as string[];
    const deadline = iso(addDays(generationDate, Math.max(0, template.dueOffsetDays)));
    await db.insert(tasks).values({
      ownerEmail: pics[0] || template.createdBy,
      title: `${template.title} · ${period.label}`,
      unit: template.unit,
      due: deadline,
      deadline,
      picEmails: template.picEmails,
      priority: template.priority,
      outputType: template.outputType,
      sourcePerformanceAgreementId: template.sourcePerformanceAgreementId,
      sourcePerformanceIndicatorId: template.sourcePerformanceIndicatorId,
      createdBy: template.createdBy,
      approvalStatus: "Tidak Perlu Persetujuan",
      notes: template.notes || template.description,
      status: "Baru",
      progress: 0,
      recurringTemplateId: template.id,
      recurringPeriodKey: period.key,
    });
    generated++;
  }
  return generated;
}
