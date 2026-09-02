import { asc, eq, inArray } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  actionPlans,
  annualWorkPlans,
  employees,
  organizationCoordinations,
  performanceAgreements,
  performanceBudgets,
  performanceEvaluations,
  performanceIndicators,
} from "../../../db/schema";
import { hasSakipOperator, requireAuthorizedUser } from "../../lib/access";
const managers = ["super_user", "super_admin", "admin"];
const flattenObjectives = (payload: any) => {
  if (Array.isArray(payload.objectives))
    return payload.objectives.flatMap((objective: any, groupIndex: number) =>
      (Array.isArray(objective.indicators) ? objective.indicators : []).map((indicator: any, indicatorIndex: number) => ({
        ...indicator,
        objective: objective.objective,
        objectiveType: objective.objectiveType,
        objectiveGroup: groupIndex + 1,
        sortOrder: indicatorIndex,
      })),
    );
  return Array.isArray(payload.indicators)
    ? payload.indicators.map((indicator: any, index: number) => ({ ...indicator, objectiveGroup: indicator.objectiveGroup || index + 1, sortOrder: index }))
    : [];
};
export async function GET(request: Request) {
  try {
    const me = await requireAuthorizedUser(request),
      db = getDb(),
      staff = await db
        .select()
        .from(employees)
        .orderBy(asc(employees.fullName)),
      self = me.isEmployee ? staff.find((e) => e.email === me.email) : null,
      all = await db
        .select()
        .from(performanceAgreements)
        .orderBy(asc(performanceAgreements.year));
    const manageAll=managers.includes(me.role)||hasSakipOperator(me);
    let visible = all;
    if (!manageAll) {
      const own = all.filter(
        (a) => a.employeeId === self?.id || a.supervisorId === self?.id,
      );
      if (self?.position === "Anggota") {
        const links = await db
            .select()
            .from(organizationCoordinations)
            .where(
              eq(organizationCoordinations.commissionerEmployeeId, self.id),
            ),
          units = links.map((x) => x.unitSubsection),
          ids = staff
            .filter((e) => units.includes(e.unitSubsection))
            .map((e) => e.id);
        visible = all.filter(
          (a) =>
            own.some((x) => x.id === a.id) ||
            ids.includes(a.employeeId) ||
            a.coordinationCommissionerId === self.id,
        );
      } else visible = own;
    }
    const ids = visible.map((a) => a.id),
      indicators = ids.length
        ? await db
            .select()
            .from(performanceIndicators)
            .where(inArray(performanceIndicators.agreementId, ids))
            .orderBy(asc(performanceIndicators.sortOrder))
        : [],
      budgets = ids.length
        ? await db.select().from(performanceBudgets).where(inArray(performanceBudgets.agreementId, ids)).orderBy(asc(performanceBudgets.sortOrder))
        : [],
      indicatorIds = indicators.map((i) => i.id),
      evaluations = indicatorIds.length
        ? await db.select().from(performanceEvaluations).where(inArray(performanceEvaluations.indicatorId, indicatorIds)).orderBy(asc(performanceEvaluations.createdAt))
        : [],
      rkt = await db
        .select()
        .from(annualWorkPlans)
        .orderBy(asc(annualWorkPlans.year)),
      actions = await db
        .select()
        .from(actionPlans)
        .orderBy(asc(actionPlans.deadline));
    return Response.json({
      canManageAll: manageAll,
      selfEmployeeId: self?.id || null,
      currentEmployee: self
        ? { id: self.id, position: self.position, unit: self.unitSubsection }
        : null,
      employees: staff.map((e) => ({
        id: e.id,
        fullName: e.fullName,
        employeeNumber: e.employeeNumber,
        position: e.position,
        unit: e.unitSubsection,
        directSupervisorId: e.directSupervisorId,
      })),
      rkt,
      actionPlans: actions,
      agreements: visible.map((a) => {
        const agreementIndicators = indicators.filter((i) => i.agreementId === a.id);
        const objectiveMap = new Map<string, any>();
        for (const item of agreementIndicators) {
          const key = `${item.objectiveGroup}:${item.objectiveType}:${item.objective}`;
          if (!objectiveMap.has(key)) objectiveMap.set(key, {
            objectiveGroup: item.objectiveGroup,
            objectiveType: item.objectiveType,
            objective: item.objective,
            indicators: [],
          });
          objectiveMap.get(key).indicators.push(item);
        }
        return ({
        ...a,
        employee: staff.find((e) => e.id === a.employeeId),
        supervisor: staff.find((e) => e.id === a.supervisorId),
        commissioner: staff.find((e) => e.id === a.coordinationCommissionerId),
        parent: all.find((e) => e.id === a.parentAgreementId),
        sourceRkt: rkt.find((e) => e.id === a.sourceRktId),
        sourceAction: actions.find((e) => e.id === a.sourceActionPlanId),
        indicators: agreementIndicators,
        budgets: budgets.filter((b) => b.agreementId === a.id),
        budgetTotal: budgets.filter((b) => b.agreementId === a.id).reduce((sum, b) => sum + b.amount, 0),
        objectives: [...objectiveMap.values()].sort((x, y) => x.objectiveGroup - y.objectiveGroup),
        evaluations: evaluations.filter((e) => e.agreementId === a.id).map((e) => ({ ...e, evidenceLinks: JSON.parse(e.evidenceLinks || "[]") })),
      });}),
    });
  } catch {
    return Response.json({ error: "Akses tidak tersedia" }, { status: 403 });
  }
}
export async function POST(request: Request) {
  try {
    const me = await requireAuthorizedUser(request),
      db = getDb(),
      p = (await request.json()) as any,
      staff = await db.select().from(employees),
      self = me.isEmployee ? staff.find((e) => e.email === me.email) : null,
      employeeId =
        (managers.includes(me.role)||hasSakipOperator(me)) && p.employeeId
          ? Number(p.employeeId)
          : self?.id,
      employee = staff.find((e) => e.id === employeeId);
    if (!employee)
      return Response.json(
        { error: "Pegawai tidak ditemukan" },
        { status: 400 },
      );
    const indicators = flattenObjectives(p)
      .filter(
          (i: any) =>
            i.objective?.trim() && i.indicator?.trim() && i.target?.trim(),
        ),
      budgets = Array.isArray(p.budgets)
        ? p.budgets.filter((b: any) => b.programName?.trim()).map((b: any) => ({ ...b, amount: Math.max(0, Number(b.amount) || 0) }))
        : [];
    if (
      !p.year ||
      !p.periodStart ||
      !p.periodEnd ||
      p.periodStart > p.periodEnd ||
      !indicators.length || !budgets.length
    )
      return Response.json(
        { error: "Periode, indikator, dan minimal satu baris anggaran wajib diisi" },
        { status: 400 },
      );
    const [res] = await db
      .insert(performanceAgreements)
      .values({
        employeeId: employee.id,
        supervisorId: employee.directSupervisorId,
        year: Number(p.year),
        title: (p.title || "Perjanjian Kinerja Tahunan").trim(),
        agreementLevel: p.agreementLevel || employee.position || "Staf",
        sourceType: p.sourceType || "TUSI Kesekretariatan",
        sourceRktId: p.sourceRktId ? Number(p.sourceRktId) : null,
        sourceActionPlanId: p.sourceActionPlanId
          ? Number(p.sourceActionPlanId)
          : null,
        parentAgreementId: p.parentAgreementId
          ? Number(p.parentAgreementId)
          : null,
        coordinationCommissionerId: p.coordinationCommissionerId
          ? Number(p.coordinationCommissionerId)
          : null,
        sourceDescription: (p.sourceDescription || "").trim(),
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
        notes: (p.notes || "").trim(),
        createdBy: me.email,
      });
    const [agreement] = await db.select().from(performanceAgreements).where(eq(performanceAgreements.id, res.insertId)).limit(1);
    for (const [index, item] of indicators.entries())
      await db
        .insert(performanceIndicators)
        .values({
          agreementId: agreement.id,
          objective: item.objective.trim(),
          objectiveGroup: item.objectiveGroup || index + 1,
          objectiveType: item.objectiveType || "Sasaran Kegiatan",
          indicator: item.indicator.trim(),
          target: item.target.trim(),
          unit: (item.unit || "Dokumen").trim(),
          targetDisplay: (item.targetDisplay || `${item.target} ${item.unit || ""}`).trim(),
          sourceRktId: item.sourceRktId ? Number(item.sourceRktId) : null,
          sourceMapping: JSON.stringify(item.sourceMapping || {}),
          notes: (item.notes || "").trim(),
          sortOrder: item.sortOrder ?? index,
        });
    for (const [index, item] of budgets.entries()) await db.insert(performanceBudgets).values({
      agreementId: agreement.id, programName: item.programName.trim(), outputDescription: (item.outputDescription || "").trim(),
      amount: item.amount, allocationLevel: p.agreementLevel === "Staf" ? "Output Staf" : "Program",
      confirmationStatus: p.agreementLevel === "Staf" ? "Belum Dikonfirmasi" : "Tidak Perlu", sortOrder: index,
    });
    return Response.json({ agreement }, { status: 201 });
  } catch {
    return Response.json(
      { error: "Perjanjian Kinerja belum dapat disimpan" },
      { status: 400 },
    );
  }
}
export async function PATCH(request: Request) {
  try {
    const me = await requireAuthorizedUser(request),
      db = getDb(),
      p = (await request.json()) as any,
      staff = await db.select().from(employees),
      self = me.isEmployee ? staff.find((e) => e.email === me.email) : null;
    if (p.action === "realization") {
      const [indicator] = await db
          .select()
          .from(performanceIndicators)
          .where(eq(performanceIndicators.id, Number(p.indicatorId)))
          .limit(1),
        [agreement] = indicator
          ? await db
              .select()
              .from(performanceAgreements)
              .where(eq(performanceAgreements.id, indicator.agreementId))
              .limit(1)
          : [];
      if (!indicator || !agreement)
        return Response.json(
          { error: "Indikator tidak ditemukan" },
          { status: 404 },
        );
      if (!managers.includes(me.role) && !hasSakipOperator(me) && agreement.employeeId !== self?.id)
        return Response.json({ error: "Tidak berwenang" }, { status: 403 });
      await db
        .update(performanceIndicators)
        .set({
          realization: (p.realization || "").trim(),
          progress: Math.max(0, Math.min(100, Number(p.progress) || 0)),
          achievement: Math.max(0, Number(p.achievement) || 0),
          evidence: (p.evidence || "").trim(),
        })
        .where(eq(performanceIndicators.id, indicator.id));
      const [i] = await db.select().from(performanceIndicators).where(eq(performanceIndicators.id, indicator.id)).limit(1);
      return Response.json({ indicator: i });
    }
    const [row] = await db
      .select()
      .from(performanceAgreements)
      .where(eq(performanceAgreements.id, Number(p.id)))
      .limit(1);
    if (!row)
      return Response.json(
        { error: "Dokumen tidak ditemukan" },
        { status: 404 },
      );
    const owner = managers.includes(me.role) || hasSakipOperator(me) || row.employeeId === self?.id;
    if (p.action === "revise" && owner && row.status === "Disetujui") {
      const [cRes] = await db.insert(performanceAgreements).values({
        employeeId: row.employeeId, supervisorId: row.supervisorId, year: row.year,
        title: row.title, agreementLevel: row.agreementLevel, sourceType: row.sourceType,
        sourceRktId: row.sourceRktId, sourceActionPlanId: row.sourceActionPlanId,
        parentAgreementId: row.id, coordinationCommissionerId: row.coordinationCommissionerId,
        sourceDescription: row.sourceDescription, periodStart: row.periodStart, periodEnd: row.periodEnd,
        notes: row.notes, status: "Draft", createdBy: me.email, version: row.version + 1,
        revisionNotes: (p.notes || "Perubahan dokumen").trim(),
      });
      const [copy] = await db.select().from(performanceAgreements).where(eq(performanceAgreements.id, cRes.insertId)).limit(1);
      const oldItems = await db.select().from(performanceIndicators).where(eq(performanceIndicators.agreementId, row.id));
      for (const item of oldItems) await db.insert(performanceIndicators).values({
        agreementId: copy.id, objective: item.objective, objectiveGroup: item.objectiveGroup, objectiveType: item.objectiveType,
        indicator: item.indicator, target: item.target, unit: item.unit, targetDisplay: item.targetDisplay,
        sourceRktId: item.sourceRktId, sourceMapping: item.sourceMapping, notes: item.notes, sortOrder: item.sortOrder,
      });
      const oldBudgets = await db.select().from(performanceBudgets).where(eq(performanceBudgets.agreementId, row.id));
      for (const budget of oldBudgets) await db.insert(performanceBudgets).values({
        agreementId: copy.id, programName: budget.programName, outputDescription: budget.outputDescription, amount: budget.amount,
        allocationLevel: budget.allocationLevel, confirmationStatus: row.agreementLevel === "Staf" ? "Belum Dikonfirmasi" : "Tidak Perlu", sortOrder: budget.sortOrder,
      });
      return Response.json({ agreement: copy });
    }
    if (p.action === "confirm-budget") {
      const approver = managers.includes(me.role) || hasSakipOperator(me) || row.supervisorId === self?.id;
      if (!approver) return Response.json({ error: "Hanya atasan langsung yang dapat mengonfirmasi alokasi" }, { status: 403 });
      const [budget] = await db.select().from(performanceBudgets).where(eq(performanceBudgets.id, Number(p.budgetId))).limit(1);
      if (!budget || budget.agreementId !== row.id) return Response.json({ error: "Alokasi tidak ditemukan" }, { status: 404 });
      await db.update(performanceBudgets).set({ confirmationStatus: "Dikonfirmasi", confirmedBy: me.email, confirmedAt: new Date().toISOString().slice(0, 19).replace('T', ' ') }).where(eq(performanceBudgets.id, budget.id));
      const [updated] = await db.select().from(performanceBudgets).where(eq(performanceBudgets.id, budget.id)).limit(1);
      return Response.json({ budget: updated });
    }
    if (p.action === "finalize" && owner && row.status === "Draft") {
      if (row.agreementLevel === "Staf") {
        const allocations = await db.select().from(performanceBudgets).where(eq(performanceBudgets.agreementId, row.id));
        if (allocations.some((b) => b.confirmationStatus !== "Dikonfirmasi")) return Response.json({ error: "Seluruh alokasi anggaran staf harus dikonfirmasi atasan sebelum PK ditetapkan final" }, { status: 400 });
      }
      await db.update(performanceAgreements).set({
        status: "Disetujui", approvedBy: me.email,
        approvedAt: new Date().toISOString().slice(0, 19).replace('T', ' '), updatedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
      }).where(eq(performanceAgreements.id, row.id));
      const [u] = await db.select().from(performanceAgreements).where(eq(performanceAgreements.id, row.id)).limit(1);
      return Response.json({ agreement: u });
    }
    if (p.action === "update" && owner && row.status === "Draft") {
      const items = flattenObjectives(p).filter((i: any) => i.objective?.trim() && i.indicator?.trim() && i.target?.trim());
      const budgetItems = Array.isArray(p.budgets) ? p.budgets.filter((b: any) => b.programName?.trim()) : [];
      if (!items.length || !budgetItems.length) return Response.json({ error: "Minimal satu sasaran dan satu baris anggaran wajib diisi" }, { status: 400 });
      await db.update(performanceAgreements).set({
        employeeId: (managers.includes(me.role)||hasSakipOperator(me)) && p.employeeId ? Number(p.employeeId) : row.employeeId,
        year: Number(p.year) || row.year, title: (p.title || row.title).trim(),
        agreementLevel: p.agreementLevel || row.agreementLevel,
        sourceType: p.sourceType || row.sourceType,
        sourceRktId: p.sourceRktId ? Number(p.sourceRktId) : null,
        sourceActionPlanId: p.sourceActionPlanId ? Number(p.sourceActionPlanId) : null,
        parentAgreementId: p.parentAgreementId ? Number(p.parentAgreementId) : null,
        coordinationCommissionerId: p.coordinationCommissionerId ? Number(p.coordinationCommissionerId) : null,
        sourceDescription: (p.sourceDescription || "").trim(), notes: (p.notes || "").trim(),
        periodStart: p.periodStart, periodEnd: p.periodEnd, updatedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
      }).where(eq(performanceAgreements.id, row.id));
      await db.delete(performanceIndicators).where(eq(performanceIndicators.agreementId, row.id));
      for (const [index, item] of items.entries()) await db.insert(performanceIndicators).values({
        agreementId: row.id, objective: item.objective.trim(), objectiveGroup: item.objectiveGroup || index + 1, objectiveType: item.objectiveType || "Sasaran Kegiatan",
        indicator: item.indicator.trim(), target: item.target.trim(), unit: (item.unit || "").trim(),
        targetDisplay: (item.targetDisplay || `${item.target} ${item.unit || ""}`).trim(),
        sourceRktId: item.sourceRktId ? Number(item.sourceRktId) : null,
        sourceMapping: JSON.stringify(item.sourceMapping || {}), notes: (item.notes || "").trim(), sortOrder: item.sortOrder ?? index,
      });
      await db.delete(performanceBudgets).where(eq(performanceBudgets.agreementId, row.id));
      for (const [index, item] of budgetItems.entries()) await db.insert(performanceBudgets).values({
        agreementId: row.id, programName: item.programName.trim(), outputDescription: (item.outputDescription || "").trim(),
        amount: Math.max(0, Number(item.amount) || 0), allocationLevel: p.agreementLevel === "Staf" ? "Output Staf" : "Program",
        confirmationStatus: p.agreementLevel === "Staf" ? "Belum Dikonfirmasi" : "Tidak Perlu", sortOrder: index,
      });
      return Response.json({ success: true });
    }
    const approver = managers.includes(me.role) || hasSakipOperator(me) || row.supervisorId === self?.id;
    if (
      p.action === "submit" &&
      owner &&
      ["Draft", "Dikembalikan"].includes(row.status)
    ) {
      await db
        .update(performanceAgreements)
        .set({
          status: "Diajukan",
          revisionNotes: "",
          updatedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
        })
        .where(eq(performanceAgreements.id, row.id));
      const [u] = await db.select().from(performanceAgreements).where(eq(performanceAgreements.id, row.id)).limit(1);
      return Response.json({ agreement: u });
    }
    if (p.action === "approve" && approver && row.status === "Diajukan") {
      await db
        .update(performanceAgreements)
        .set({
          status: "Disetujui",
          approvedBy: me.email,
          approvedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
          updatedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
        })
        .where(eq(performanceAgreements.id, row.id));
      const [u] = await db.select().from(performanceAgreements).where(eq(performanceAgreements.id, row.id)).limit(1);
      return Response.json({ agreement: u });
    }
    if (p.action === "return" && approver && row.status === "Diajukan") {
      await db
        .update(performanceAgreements)
        .set({
          status: "Dikembalikan",
          revisionNotes: (p.notes || "Perlu perbaikan").trim(),
          version: row.version + 1,
          updatedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
        })
        .where(eq(performanceAgreements.id, row.id));
      const [u] = await db.select().from(performanceAgreements).where(eq(performanceAgreements.id, row.id)).limit(1);
      return Response.json({ agreement: u });
    }
    return Response.json({ error: "Aksi tidak diizinkan" }, { status: 403 });
  } catch {
    return Response.json(
      { error: "Data belum dapat diperbarui" },
      { status: 400 },
    );
  }
}
export async function DELETE(request: Request) {
  try {
    const me = await requireAuthorizedUser(request),
      db = getDb(),
      id = Number(new URL(request.url).searchParams.get("id")),
      [row] = await db
        .select()
        .from(performanceAgreements)
        .where(eq(performanceAgreements.id, id))
        .limit(1),
      [self] = me.isEmployee
        ? await db
            .select()
            .from(employees)
            .where(eq(employees.email, me.email))
            .limit(1)
        : [];
    if (!row)
      return Response.json(
        { error: "Dokumen tidak ditemukan" },
        { status: 404 },
      );
    if (!managers.includes(me.role) && !hasSakipOperator(me) && row.employeeId !== self?.id)
      return Response.json({ error: "Tidak berwenang" }, { status: 403 });
    if (row.status !== "Draft")
      return Response.json(
        { error: "Hanya Draft yang dapat dihapus" },
        { status: 400 },
      );
    await db
      .delete(performanceIndicators)
      .where(eq(performanceIndicators.agreementId, id));
    await db.delete(performanceBudgets).where(eq(performanceBudgets.agreementId, id));
    await db
      .delete(performanceAgreements)
      .where(eq(performanceAgreements.id, id));
    return Response.json({ success: true });
  } catch {
    return Response.json(
      { error: "Dokumen belum dapat dihapus" },
      { status: 400 },
    );
  }
}
