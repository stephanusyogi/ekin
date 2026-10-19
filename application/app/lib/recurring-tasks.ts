import { and, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { recurringTaskTemplates, tasks } from "../../db/schema";

const iso = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (date: Date, days: number) => { const next = new Date(date); next.setUTCDate(next.getUTCDate() + days); return next; };
const getWibDate = (date: Date) => new Date(date.getTime() + 7 * 60 * 60 * 1000);

function periodFor(date: Date, frequency: string) {
  const wib = getWibDate(date);
  const year = wib.getUTCFullYear(), month = wib.getUTCMonth();
  if (frequency === "Mingguan") {
    const dayOfWeek = (wib.getUTCDay() + 6) % 7;
    const monday = addDays(new Date(Date.UTC(year, month, wib.getUTCDate())), -dayOfWeek);
    return { start: monday, key: `W-${iso(monday)}`, label: `Minggu ${iso(monday)}` };
  }
  if (frequency === "Bulanan") {
    const monthStart = new Date(Date.UTC(year, month, 1));
    return {
      start: monthStart,
      key: `${year}-${String(month + 1).padStart(2, "0")}`,
      label: new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(monthStart),
    };
  }
  const span = frequency === "Triwulan" ? 3 : 6;
  const index = Math.floor(month / span);
  const periodStart = new Date(Date.UTC(year, index * span, 1));
  return {
    start: periodStart,
    key: `${year}-${frequency === "Triwulan" ? "T" : "S"}${index + 1}`,
    label: `${frequency} ${index + 1} · ${year}`,
  };
}

export async function generateRecurringTasks(now = new Date()) {
  const db = getDb();
  const templates = await db.select().from(recurringTaskTemplates).where(eq(recurringTaskTemplates.status, "Aktif"));
  let generated = 0;
  const wibNow = getWibDate(now);
  const today = iso(new Date(Date.UTC(wibNow.getUTCFullYear(), wibNow.getUTCMonth(), wibNow.getUTCDate())));

  for (const template of templates) {
    const period = periodFor(now, template.frequency);
    const generationDate = addDays(period.start, Math.max(0, template.generationDay - 1));
    if (today < iso(generationDate) || today < template.startDate || (template.endDate && today > template.endDate)) continue;

    const [existing] = await db.select().from(tasks).where(and(eq(tasks.recurringTemplateId, template.id), eq(tasks.recurringPeriodKey, period.key))).limit(1);
    if (existing) continue;

    const pics = JSON.parse(template.picEmails || "[]") as string[];
    const deadline = iso(addDays(generationDate, Math.max(0, template.dueOffsetDays)));
    try {
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
    } catch (insertError: any) {
      if (insertError?.code === "ER_DUP_ENTRY" || String(insertError?.message || "").includes("Duplicate entry")) {
        continue;
      }
      console.error("[generateRecurringTasks] Failed to insert task:", insertError);
    }
  }
  return generated;
}
