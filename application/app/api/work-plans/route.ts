import { asc, eq, inArray } from "drizzle-orm";
import { getDb } from "../../../db";
import { actionPlans, annualWorkPlans, employees, performanceAgreements, performanceIndicators } from "../../../db/schema";
import { hasSakipOperator, requireAuthorizedUser } from "../../lib/access";
import { cleanEvidenceLinks, logSecurityEvent } from "../../lib/security";

const managers = ["super_user", "super_admin", "admin"];
const flattenPrograms = (p: any) => (Array.isArray(p.programs) ? p.programs : []).flatMap((program: any, programOrder: number) =>
  (Array.isArray(program.objectives) ? program.objectives : []).flatMap((objective: any, objectiveOrder: number) =>
    (Array.isArray(objective.indicators) ? objective.indicators : []).map((indicator: any, indicatorOrder: number) => ({
      id: indicator.id ? Number(indicator.id) : null, programActivity: (program.programActivity || "").trim(),
      strategicObjective: (objective.objective || "").trim(), indicator: (indicator.indicator || "").trim(),
      target: (indicator.target || "").trim(), unit: (indicator.unit || "").trim(), programOrder, objectiveOrder, indicatorOrder,
    })),
  ),
);

async function actor(request: Request) {
  const me = await requireAuthorizedUser(request), db = getDb();
  const [self] = me.isEmployee ? await db.select().from(employees).where(eq(employees.email, me.email)).limit(1) : [];
  return { me, db, self, canManage: managers.includes(me.role) || hasSakipOperator(me) || self?.position === "Ketua" || self?.position === "Sekretaris" };
}

export async function GET(request: Request) {
  try {
    const { me, db, self, canManage } = await actor(request);
    const staff = await db.select().from(employees).orderBy(asc(employees.fullName));
    const plans = await db.select().from(annualWorkPlans).orderBy(asc(annualWorkPlans.year), asc(annualWorkPlans.programOrder), asc(annualWorkPlans.objectiveOrder), asc(annualWorkPlans.indicatorOrder));
    const ids = plans.map((x) => x.id);
    const actions = ids.length ? await db.select().from(actionPlans).where(inArray(actionPlans.rktId, ids)).orderBy(asc(actionPlans.deadline)) : [];
    const grouped = new Map<string, any>();
    for (const row of plans) {
      const key = row.documentKey || `legacy-${row.id}`;
      if (!grouped.has(key)) grouped.set(key, { documentKey: key, year: row.year, rktType: row.rktType || (row.scope === "Kesekretariatan" ? "Sekretaris" : "Ketua"), scope: row.scope, policyOwnerId: row.policyOwnerId, status: row.status, notes: row.notes, programs: [], rows: [] });
      const doc = grouped.get(key); doc.rows.push(row);
      let program = doc.programs.find((x: any) => x.order === row.programOrder && x.programActivity === (row.programActivity || row.objective));
      if (!program) { program = { order: row.programOrder, programActivity: row.programActivity || row.objective, objectives: [] }; doc.programs.push(program); }
      let objective = program.objectives.find((x: any) => x.order === row.objectiveOrder && x.objective === (row.strategicObjective || row.objective));
      if (!objective) { objective = { order: row.objectiveOrder, objective: row.strategicObjective || row.objective, indicators: [] }; program.objectives.push(objective); }
      objective.indicators.push({ id: row.id, indicator: row.indicator, target: row.target, unit: row.unit, order: row.indicatorOrder });
    }
    return Response.json({ canManage, employees: staff.map((e) => ({ id: e.id, fullName: e.fullName, position: e.position, unit: e.unitSubsection })),
      plans: plans.map((r) => ({ ...r, owner: staff.find((e) => e.id === r.policyOwnerId), actions: actions.filter((a) => a.rktId === r.id).map((a) => ({ ...a, pic: staff.find((e) => e.id === a.picEmployeeId) })) })),
      documents: [...grouped.values()].map((d) => ({ ...d, owner: staff.find((e) => e.id === d.policyOwnerId), actions: actions.filter((a) => d.rows.some((r: any) => r.id === a.rktId)) })),
      currentEmployee: self ? { id: self.id, position: self.position } : null, role: me.role });
  } catch { return Response.json({ error: "Akses tidak tersedia" }, { status: 403 }); }
}

export async function POST(request: Request) {
  try {
    const { me, db, self, canManage } = await actor(request), p = await request.json() as any;
    if (!canManage) return Response.json({ error: "Tidak berwenang mengelola RKT" }, { status: 403 });
    if (p.kind === "action") {
      if (!p.rktId || !p.title?.trim()) return Response.json({ error: "RKT dan uraian Rencana Aksi wajib diisi" }, { status: 400 });
      const [res] = await db.insert(actionPlans).values({ rktId: Number(p.rktId), title: p.title.trim(), description: (p.description || "").trim(), responsibleUnit: (p.responsibleUnit || "").trim(), picEmployeeId: p.picEmployeeId ? Number(p.picEmployeeId) : null, deadline: p.deadline || "", createdBy: me.email });
      const [row] = await db.select().from(actionPlans).where(eq(actionPlans.id, res.insertId)).limit(1);
      await logSecurityEvent(request,{actorEmail:me.email,actorRole:me.role,action:"CREATE",resourceType:"action_plan",resourceId:row.id,after:row});
      return Response.json({ action: row }, { status: 201 });
    }
    const rows = flattenPrograms(p).filter((x: any) => x.programActivity && x.strategicObjective && x.indicator && x.target);
    if (!p.year || !rows.length) return Response.json({ error: "Minimal satu Program, Sasaran, Indikator, dan Target wajib diisi" }, { status: 400 });
    const documentKey = crypto.randomUUID(), rktType = p.rktType === "Sekretaris" ? "Sekretaris" : "Ketua", inserted = [];
    for (const row of rows) {
      const [res] = await db.insert(annualWorkPlans).values({ documentKey, rktType, year: Number(p.year), scope: rktType === "Sekretaris" ? "Kesekretariatan" : "Instansi", programActivity: row.programActivity, strategicObjective: row.strategicObjective, objective: row.strategicObjective, indicator: row.indicator, target: row.target, unit: row.unit, programOrder: row.programOrder, objectiveOrder: row.objectiveOrder, indicatorOrder: row.indicatorOrder, policyOwnerId: p.policyOwnerId ? Number(p.policyOwnerId) : self?.id || null, notes: (p.notes || "").trim(), status: p.status === "Draft" ? "Draft" : "Aktif", createdBy: me.email });
      const [created] = await db.select().from(annualWorkPlans).where(eq(annualWorkPlans.id, res.insertId)).limit(1);
      inserted.push(created);
    }
    await logSecurityEvent(request,{actorEmail:me.email,actorRole:me.role,action:"CREATE",resourceType:"rkt",resourceId:documentKey,after:{year:p.year,rktType,count:inserted.length}});return Response.json({ documentKey, plans: inserted }, { status: 201 });
  } catch { return Response.json({ error: "Data RKT belum dapat disimpan" }, { status: 400 }); }
}

export async function PATCH(request: Request) {
  try {
    const { me, db, canManage } = await actor(request), p = await request.json() as any;
    if (!canManage) return Response.json({ error: "Tidak berwenang" }, { status: 403 });
    if (p.kind === "action") {
      const [before]=await db.select().from(actionPlans).where(eq(actionPlans.id,Number(p.id))).limit(1),evidence=cleanEvidenceLinks(p.evidence).join("\n");
      await db.update(actionPlans).set({ progress: Math.max(0, Math.min(100, Number(p.progress) || 0)), realization: (p.realization || "").trim(), evidence, updatedAt: new Date().toISOString().slice(0, 19).replace('T', ' ') }).where(eq(actionPlans.id, Number(p.id)));
      const [row] = await db.select().from(actionPlans).where(eq(actionPlans.id, Number(p.id))).limit(1);
      await logSecurityEvent(request,{actorEmail:me.email,actorRole:me.role,action:"UPDATE",resourceType:"action_plan",resourceId:p.id,before,after:row});
      return Response.json({ action: row });
    }
    if (!p.documentKey) return Response.json({ error: "Dokumen RKT tidak ditemukan" }, { status: 400 });
    const legacyId = String(p.documentKey).startsWith("legacy-") ? Number(String(p.documentKey).replace("legacy-", "")) : null;
    const existing = legacyId
      ? await db.select().from(annualWorkPlans).where(eq(annualWorkPlans.id, legacyId))
      : await db.select().from(annualWorkPlans).where(eq(annualWorkPlans.documentKey, p.documentKey));
    if (!existing.length) return Response.json({ error: "Dokumen RKT tidak ditemukan" }, { status: 404 });
    const rows = flattenPrograms(p).filter((x: any) => x.programActivity && x.strategicObjective && x.indicator && x.target);
    if (!rows.length) return Response.json({ error: "Minimal satu indikator wajib dipertahankan" }, { status: 400 });
    const keptIds = rows.filter((x: any) => x.id).map((x: any) => x.id), removedIds = existing.filter((x) => !keptIds.includes(x.id)).map((x) => x.id);
    if (removedIds.length) {
      const linkedActions = await db.select().from(actionPlans).where(inArray(actionPlans.rktId, removedIds));
      const linkedPk = await db.select().from(performanceAgreements).where(inArray(performanceAgreements.sourceRktId, removedIds));
      const linkedIndicators = await db.select().from(performanceIndicators).where(inArray(performanceIndicators.sourceRktId, removedIds));
      if (linkedActions.length || linkedPk.length || linkedIndicators.length) return Response.json({ error: "Indikator RKT yang sudah menjadi sumber data tidak dapat dihapus" }, { status: 400 });
      await db.delete(annualWorkPlans).where(inArray(annualWorkPlans.id, removedIds));
    }
    const rktType = p.rktType === "Sekretaris" ? "Sekretaris" : "Ketua";
    for (const row of rows) {
      const values = { rktType, year: Number(p.year), scope: rktType === "Sekretaris" ? "Kesekretariatan" as const : "Instansi" as const, programActivity: row.programActivity, strategicObjective: row.strategicObjective, objective: row.strategicObjective, indicator: row.indicator, target: row.target, unit: row.unit, programOrder: row.programOrder, objectiveOrder: row.objectiveOrder, indicatorOrder: row.indicatorOrder, policyOwnerId: p.policyOwnerId ? Number(p.policyOwnerId) : null, notes: (p.notes || "").trim(), status: p.status === "Draft" ? "Draft" as const : "Aktif" as const, updatedAt: new Date().toISOString().slice(0, 19).replace('T', ' ') };
      if (row.id) await db.update(annualWorkPlans).set(values).where(eq(annualWorkPlans.id, row.id));
      else await db.insert(annualWorkPlans).values({ ...values, documentKey: p.documentKey, createdBy: me.email });
    }
    await logSecurityEvent(request,{actorEmail:me.email,actorRole:me.role,action:"UPDATE",resourceType:"rkt",resourceId:p.documentKey,before:existing,after:{year:p.year,rktType,count:rows.length}});return Response.json({ success: true });
  } catch { return Response.json({ error: "Data belum dapat diperbarui" }, { status: 400 }); }
}

export async function DELETE(request: Request) {
  try {
    const { me, db } = await actor(request);
    if (!managers.includes(me.role) && !hasSakipOperator(me)) return Response.json({ error: "Hanya pengelola sistem atau Operator SAKIP yang dapat menghapus RKT" }, { status: 403 });
    const documentKey = new URL(request.url).searchParams.get("documentKey") || "";
    const legacyId = documentKey.startsWith("legacy-") ? Number(documentKey.replace("legacy-", "")) : null;
    const rows = legacyId
      ? await db.select().from(annualWorkPlans).where(eq(annualWorkPlans.id, legacyId))
      : await db.select().from(annualWorkPlans).where(eq(annualWorkPlans.documentKey, documentKey)), ids = rows.map((x) => x.id);
    if (!ids.length) return Response.json({ error: "Dokumen RKT tidak ditemukan" }, { status: 404 });
    const linkedActions = await db.select().from(actionPlans).where(inArray(actionPlans.rktId, ids));
    const linkedPk = await db.select().from(performanceAgreements).where(inArray(performanceAgreements.sourceRktId, ids));
    const linkedIndicators = await db.select().from(performanceIndicators).where(inArray(performanceIndicators.sourceRktId, ids));
    if (linkedActions.length || linkedPk.length || linkedIndicators.length) return Response.json({ error: "RKT sudah menjadi sumber Rencana Aksi/PK dan tidak dapat dihapus" }, { status: 400 });
    if (legacyId) await db.delete(annualWorkPlans).where(eq(annualWorkPlans.id, legacyId));
    else await db.delete(annualWorkPlans).where(eq(annualWorkPlans.documentKey, documentKey));
    await logSecurityEvent(request,{actorEmail:me.email,actorRole:me.role,action:"DELETE",resourceType:"rkt",resourceId:documentKey,before:rows});return Response.json({ success: true });
  } catch { return Response.json({ error: "RKT belum dapat dihapus" }, { status: 400 }); }
}
