import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { employees, monevPeriodLocks, performanceAgreements, performanceBudgets, performanceEvaluations, performanceIndicators } from "../../../db/schema";
import { hasSakipOperator, requireAuthorizedUser } from "../../lib/access";
import { cleanEvidenceLinks, logSecurityEvent } from "../../lib/security";

const managers = ["super_user", "super_admin", "admin", "operator"];
const validPeriod = (type: string, key: string, year: number) => {
  if (type === "Bulanan") return [`${year}-01`, `${year}-02`, `${year}-04`, `${year}-05`, `${year}-07`, `${year}-08`, `${year}-10`, `${year}-11`].includes(key);
  if (type === "Triwulanan") return [`${year}-Q1`, `${year}-Q2`, `${year}-Q3`, `${year}-Q4`].includes(key);
  return type === "Tahunan" && key === String(year);
};
const cleanLinks = cleanEvidenceLinks;

async function isPeriodLocked(db: ReturnType<typeof getDb>, periodKey: string) {
  const [lock] = await db.select().from(monevPeriodLocks).where(eq(monevPeriodLocks.periodKey, periodKey)).limit(1);
  return Boolean(lock?.isLocked);
}

async function context(request: Request) {
  const me = await requireAuthorizedUser(request), db = getDb();
  const [self] = me.isEmployee ? await db.select().from(employees).where(eq(employees.email, me.email)).limit(1) : [];
  return { me, db, self };
}

async function refreshIndicator(db: ReturnType<typeof getDb>, indicatorId: number) {
  try {
    const rows = await db
      .select()
      .from(performanceEvaluations)
      .where(eq(performanceEvaluations.indicatorId, indicatorId))
      .orderBy(asc(performanceEvaluations.id));
    const latest = rows.at(-1);

    let links: string[] = [];
    if (latest?.evidenceLinks) {
      try {
        const parsed = JSON.parse(latest.evidenceLinks);
        links = cleanLinks(parsed);
      } catch {
        links = cleanLinks(latest.evidenceLinks);
      }
    }
    const fullEvidence = links.join("\n");
    const progress = latest?.progress || 0;
    const realization = latest?.outputRealization || "";

    // 1. Coba update penuh dengan semua link bukti dukung
    try {
      await db
        .update(performanceIndicators)
        .set({
          progress,
          realization,
          evidence: fullEvidence,
        })
        .where(eq(performanceIndicators.id, indicatorId));
      return;
    } catch (err1) {
      console.warn("refreshIndicator: update full evidence gagal (kemungkinan tipe/panjang VARCHAR terbatas di MariaDB), mencoba fallback...", err1);
    }

    // 2. Fallback: jika kolom evidence di MySQL/MariaDB terbatas (misal VARCHAR 100/255)
    try {
      const shortEvidence = (links[0] || "").slice(0, 100);
      await db
        .update(performanceIndicators)
        .set({
          progress,
          realization,
          evidence: shortEvidence,
        })
        .where(eq(performanceIndicators.id, indicatorId));
      return;
    } catch (err2) {
      console.warn("refreshIndicator: update short evidence gagal, mencoba update progress & realization tanpa kolom evidence...", err2);
    }

    // 3. Fallback: update progress dan realization saja tanpa menyentuh kolom evidence
    try {
      await db
        .update(performanceIndicators)
        .set({
          progress,
          realization,
        })
        .where(eq(performanceIndicators.id, indicatorId));
    } catch (err3) {
      console.error("refreshIndicator: update progress & realization gagal:", err3);
    }
  } catch (err) {
    console.error("refreshIndicator unexpected error:", err);
  }
}

export async function POST(request: Request) {
  try {
    const { me, db, self } = await context(request), p = await request.json() as any;
    const [indicator] = await db.select().from(performanceIndicators).where(eq(performanceIndicators.id, Number(p.indicatorId))).limit(1);
    const [agreement] = indicator ? await db.select().from(performanceAgreements).where(eq(performanceAgreements.id, indicator.agreementId)).limit(1) : [];
    if (!indicator || !agreement) return Response.json({ error: "Indikator tidak ditemukan" }, { status: 404 });
    const canManage = managers.includes(me.role) || hasSakipOperator(me);
    if (!canManage && agreement.employeeId !== self?.id) return Response.json({ error: "Tidak berwenang" }, { status: 403 });
    if (!validPeriod(p.periodType, p.periodKey, agreement.year)) return Response.json({ error: "Periode Monev tidak sesuai kalender Monev tahun kinerja" }, { status: 400 });
    if (!canManage && await isPeriodLocked(db, p.periodKey)) {
      return Response.json({ error: `Periode Monev (${p.periodKey}) sudah dikunci oleh Pimpinan. Input data dialihkan ke periode berikutnya.` }, { status: 403 });
    }
    const amount = Math.max(0, Number(p.budgetRealization) || 0);
    const budgets = await db.select().from(performanceBudgets).where(eq(performanceBudgets.agreementId, agreement.id));
    const ceiling = budgets.reduce((sum, x) => sum + x.amount, 0);
    if (amount > ceiling && !(p.notes || "").trim()) return Response.json({ error: "Realisasi melebihi alokasi. Isi Keterangan untuk menjelaskan selisihnya." }, { status: 400 });
    const [res] = await db.insert(performanceEvaluations).values({
      agreementId: agreement.id, indicatorId: indicator.id, periodType: p.periodType, periodKey: p.periodKey,
      progress: Math.max(0, Math.min(100, Number(p.progress) || 0)), budgetRealization: amount,
      outputRealization: (p.outputRealization || "").trim(), problemIdentification: (p.problemIdentification || "").trim(),
      improvementEffort: (p.improvementEffort || "").trim(), completedActivities: (p.completedActivities || "").trim(),
      evidenceLinks: JSON.stringify(cleanLinks(p.evidenceLinks)), notes: (p.notes || "").trim(), createdBy: me.email,
    });
    const [row] = await db.select().from(performanceEvaluations).where(eq(performanceEvaluations.id, res.insertId)).limit(1);
    await logSecurityEvent(request,{actorEmail:me.email,actorRole:me.role,action:"CREATE",resourceType:"monev",resourceId:row.id,after:row});
    await refreshIndicator(db, indicator.id);
    return Response.json({ evaluation: row }, { status: 201 });
  } catch (error) {
    console.error("performanceEvaluations POST error:", error, (error as any)?.cause);
    const message = error instanceof Error && error.message==="INVALID_EVIDENCE_LINK"?"Link bukti dukung wajib berupa tautan yang valid dan maksimal 2.048 karakter":error instanceof Error && error.message.includes("UNIQUE") ? "Monev untuk indikator dan periode tersebut sudah ada" : (error instanceof Error ? error.message : "Monev belum dapat disimpan");
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { me, db, self } = await context(request), p = await request.json() as any;
    const [row] = await db.select().from(performanceEvaluations).where(eq(performanceEvaluations.id, Number(p.id))).limit(1);
    const [agreement] = row ? await db.select().from(performanceAgreements).where(eq(performanceAgreements.id, row.agreementId)).limit(1) : [];
    if (!row || !agreement) return Response.json({ error: "Data Monev tidak ditemukan" }, { status: 404 });
    const canManage = managers.includes(me.role) || hasSakipOperator(me);
    if (!canManage && agreement.employeeId !== self?.id) return Response.json({ error: "Tidak berwenang" }, { status: 403 });
    if (!validPeriod(p.periodType, p.periodKey, agreement.year)) return Response.json({ error: "Periode Monev tidak sesuai kalender Monev tahun kinerja" }, { status: 400 });
    if (!canManage && (await isPeriodLocked(db, row.periodKey) || await isPeriodLocked(db, p.periodKey))) {
      return Response.json({ error: "Periode Monev ini sudah dikunci oleh Pimpinan dan tidak dapat diubah." }, { status: 403 });
    }
    const amount = Math.max(0, Number(p.budgetRealization) || 0), budgets = await db.select().from(performanceBudgets).where(eq(performanceBudgets.agreementId, agreement.id));
    const ceiling = budgets.reduce((sum, x) => sum + x.amount, 0);
    if (amount > ceiling && !(p.notes || "").trim()) return Response.json({ error: "Realisasi melebihi alokasi. Isi Keterangan untuk menjelaskan selisihnya." }, { status: 400 });
    await db.update(performanceEvaluations).set({
      periodType: p.periodType, periodKey: p.periodKey, progress: Math.max(0, Math.min(100, Number(p.progress) || 0)),
      budgetRealization: amount, outputRealization: (p.outputRealization || "").trim(),
      problemIdentification: (p.problemIdentification || "").trim(), improvementEffort: (p.improvementEffort || "").trim(),
      completedActivities: (p.completedActivities || "").trim(), evidenceLinks: JSON.stringify(cleanLinks(p.evidenceLinks)),
      notes: (p.notes || "").trim(), updatedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
    }).where(eq(performanceEvaluations.id, row.id));
    const [updated] = await db.select().from(performanceEvaluations).where(eq(performanceEvaluations.id, row.id)).limit(1);
    await logSecurityEvent(request,{actorEmail:me.email,actorRole:me.role,action:"UPDATE",resourceType:"monev",resourceId:row.id,before:row,after:updated});
    await refreshIndicator(db, row.indicatorId);
    return Response.json({ evaluation: updated });
  } catch(error) {
    console.error("performanceEvaluations PATCH error:", error, (error as any)?.cause);
    return Response.json({ error: error instanceof Error&&error.message==="INVALID_EVIDENCE_LINK"?"Link bukti dukung wajib berupa tautan yang valid dan maksimal 2.048 karakter":(error instanceof Error ? error.message : "Monev belum dapat diperbarui") }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { me, db, self } = await context(request), id = Number(new URL(request.url).searchParams.get("id"));
    const [row] = await db.select().from(performanceEvaluations).where(eq(performanceEvaluations.id, id)).limit(1);
    const [agreement] = row ? await db.select().from(performanceAgreements).where(eq(performanceAgreements.id, row.agreementId)).limit(1) : [];
    if (!row || !agreement) return Response.json({ error: "Data Monev tidak ditemukan" }, { status: 404 });
    const canManage = managers.includes(me.role) || hasSakipOperator(me);
    if (!canManage && agreement.employeeId !== self?.id) return Response.json({ error: "Tidak berwenang" }, { status: 403 });
    if (!canManage && await isPeriodLocked(db, row.periodKey)) {
      return Response.json({ error: "Periode Monev ini sudah dikunci oleh Pimpinan dan tidak dapat dihapus." }, { status: 403 });
    }
    await db.delete(performanceEvaluations).where(eq(performanceEvaluations.id, id));
    await logSecurityEvent(request,{actorEmail:me.email,actorRole:me.role,action:"DELETE",resourceType:"monev",resourceId:id,before:row});
    await refreshIndicator(db, row.indicatorId);
    return Response.json({ success: true });
  } catch { return Response.json({ error: "Monev belum dapat dihapus" }, { status: 400 }); }
}
