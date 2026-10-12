"use client";
import { useEffect, useState } from "react";
const sources = [
  "RKT Instansi",
  "PK Ketua",
  "Dukungan Bidang Anggota",
  "RKT Kesekretariatan",
  "TUSI Kesekretariatan",
  "Kewajiban Regulasi",
  "Penugasan Khusus",
  "Manual",
];
const blankIndicator = () => ({
  indicator: "",
  target: "",
  unit: "",
  targetDisplay: "",
  sourceRktId: "",
  sourceMapping: { objective: "programActivity", indicator: "indicator", target: "target" },
  notes: "",
});
const blankObjective = () => ({
  objectiveType: "Sasaran Kegiatan",
  objective: "",
  indicators: [blankIndicator()],
});
const blankBudget = () => ({ programName: "", outputDescription: "", amount: 0 });
const blankMonev = () => ({ id: "", periodType: "Bulanan", periodKey: "", progress: 0, budgetRealization: 0, outputRealization: "", problemIdentification: "", improvementEffort: "", completedActivities: "", evidenceLinks: [""], notes: "" });
const rupiah = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value || 0);
const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const monthlyPeriods = [1, 2, 4, 5, 7, 8, 10, 11];
const periodOrder = (type: string, value: string) => {
  if (type === "Tahunan") return Number(value) * 12 + 12;
  const quarter = String(value || "").match(/^(\d{4})-Q([1-3])$/);
  if (quarter) return Number(quarter[1]) * 12 + Number(quarter[2]) * 3;
  const month = String(value || "").match(/^(\d{4})-(\d{2})$/);
  return month ? Number(month[1]) * 12 + Number(month[2]) : 0;
};
const periodDetails = (type: string, value: string) => {
  if (type === "Tahunan") return { evaluated: `Tahun Kinerja ${value}`, submitted: `Januari ${Number(value) + 1}` };
  const quarter = String(value || "").match(/^(\d{4})-Q([1-3])$/);
  if (quarter) return { evaluated: `Triwulan ${quarter[2]} Tahun ${quarter[1]}`, submitted: `${monthNames[Number(quarter[2]) * 3]} ${quarter[1]}` };
  const month = String(value || "").match(/^(\d{4})-(\d{2})$/);
  if (month) return { evaluated: `${monthNames[Number(month[2]) - 1]} ${month[1]}`, submitted: `${monthNames[Number(month[2])]} ${month[1]}` };
  return { evaluated: "Belum dipilih", submitted: "—" };
};
const previousMonev = (agreement: any, indicatorId: number, form: any) => {
  const currentOrder = periodOrder(form.periodType, form.periodKey);
  return agreement.evaluations
    .filter((item: any) => item.indicatorId === indicatorId && item.id !== form.id)
    .filter((item: any) => !currentOrder || periodOrder(item.periodType, item.periodKey) < currentOrder)
    .sort((a: any, b: any) => periodOrder(b.periodType, b.periodKey) - periodOrder(a.periodType, a.periodKey))[0] || null;
};
const blankRktIndicator = () => ({ indicator: "", target: "", unit: "" });
const blankRktObjective = () => ({ objective: "", indicators: [blankRktIndicator()] });
const blankRktProgram = () => ({ programActivity: "", budgetAmount: 0, objectives: [blankRktObjective()] });
const blankActionForm = (rktId = "", picEmployeeId = "") => ({ id: undefined, rktId, title: "", description: "", responsibleUnit: "", picEmployeeId, deadline: "" });
const clonePrograms = (progs: any[]) => (progs || []).map((p: any) => ({
  programActivity: p.programActivity || "",
  budgetAmount: Number(p.budgetAmount || 0),
  objectives: (p.objectives || []).map((o: any) => ({
    objective: o.objective || "",
    indicators: (o.indicators || []).map((i: any) => ({
      indicator: i.indicator || "",
      target: i.target || "",
      unit: i.unit || "",
    }))
  }))
}));
export default function PerformanceAgreementCenter() {
  const year = new Date().getFullYear(),
    [tab, setTab] = useState<"rkt" | "pk" | "monitor">("pk"),
    [data, setData] = useState<any>({
      employees: [],
      agreements: [],
      rkt: [],
      actionPlans: [],
    }),
    [plans, setPlans] = useState<any>({ plans: [], employees: [] }),
    [showPk, setShowPk] = useState(false),
    [showRkt, setShowRkt] = useState(false),
    [showAction, setShowAction] = useState(false),
    [expandedRakTree, setExpandedRakTree] = useState<Record<string, boolean>>({}),
    [selectedKetuaProgram, setSelectedKetuaProgram] = useState(""),
    [inheritedInfo, setInheritedInfo] = useState<any>(null),
    [saving, setSaving] = useState(false),
    [toast, setToast] = useState(""),
    [filter, setFilter] = useState("Semua"),
    [pkTypeFilter, setPkTypeFilter] = useState("Semua"),
    [rktFilter, setRktFilter] = useState("Semua"),
    [viewingActions, setViewingActions] = useState<any>(null),
    [monevTypeFilter, setMonevTypeFilter] = useState("Semua"),
    [monevYearFilter, setMonevYearFilter] = useState(String(year)),
    [monevUnitFilter, setMonevUnitFilter] = useState("Semua"),
    [form, setForm] = useState<any>({
      employeeId: "",
      year,
      title: "Perjanjian Kinerja Tahunan",
      agreementLevel: "Staf",
      sourceType: "TUSI Kesekretariatan",
      sourceRktId: "",
      sourceActionPlanId: "",
      parentAgreementId: "",
      coordinationCommissionerId: "",
      sourceDescription: "",
      periodStart: `${year}-01-01`,
      periodEnd: `${year}-12-31`,
      notes: "",
      objectives: [blankObjective()],
      budgets: [blankBudget()],
    }),
    [rktForm, setRktForm] = useState<any>({
      year,
      rktType: "Ketua",
      programs: [blankRktProgram()],
      policyOwnerId: "",
      notes: "",
      status: "Aktif",
    }),
    [actionForm, setActionForm] = useState<any>(blankActionForm()),
    [editing, setEditing] = useState<any>(null);
  const notify = (m: string) => {
      setToast(m);
      setTimeout(() => setToast(""), 2600);
    },
    load = async () => {
      const [a, r] = await Promise.all([
          fetch("/api/performance-agreements"),
          fetch("/api/work-plans"),
        ]),
        aj = await a.json(),
        rj = await r.json();
      if (a.ok) {
        setData(aj);
        setForm((f: any) => ({
          ...f,
          employeeId:
            f.employeeId || aj.selfEmployeeId || aj.employees[0]?.id || "",
        }));
      }
      if (r.ok) {
        setPlans(rj);
        setRktForm((f: any) => ({
          ...f,
          policyOwnerId:
            f.policyOwnerId ||
            rj.employees.find((e: any) => e.position === "Ketua")?.id ||
            "",
        }));
        setActionForm((f: any) => ({
          ...f,
          rktId: f.rktId || rj.plans[0]?.id || "",
        }));
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => {
    load();
  }, []);
  const request = async (url: string, body: any, method = "POST") => {
    setSaving(true);
    try {
      const r = await fetch(url, {
          method,
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
        j = await r.json();
      if (!r.ok) throw new Error(j.error);
      notify("Data berhasil disimpan");
      setShowPk(false);
      setShowRkt(false);
      setShowAction(false);
      setSelectedKetuaProgram("");
      setActionForm(blankActionForm());
      setEditing(null);
      await load();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Data belum tersimpan");
    } finally {
      setSaving(false);
    }
  };
  const toggleRakInheritance = async (rktId: number, rak: any, targetEmployeeId: number, currentlyAssigned: boolean) => {
    const matchingActions = plans.plans?.flatMap((p: any) => p.actions || []).filter((a: any) => String(a.rktId) === String(rktId) && a.title === rak.title) || [];
    let currentEmpIds = matchingActions.map((a: any) => Number(a.picEmployeeId)).filter(Boolean);
    const targetIdNum = Number(targetEmployeeId);
    if (currentlyAssigned) {
      currentEmpIds = currentEmpIds.filter((id: number) => id !== targetIdNum);
    } else {
      currentEmpIds = [...new Set([...currentEmpIds, targetIdNum])];
    }
    await request("/api/work-plans", {
      kind: "sync-rak-inheritance",
      rktId,
      title: rak.title,
      description: rak.description || "",
      deadline: rak.deadline || "",
      responsibleUnit: rak.responsibleUnit || "",
      employeeIds: currentEmpIds,
    });
  };
  const batchAssignRakGroup = async (rktId: number, rak: any, groupEmployeeIds: number[], assignAll: boolean) => {
    const matchingActions = plans.plans?.flatMap((p: any) => p.actions || []).filter((a: any) => String(a.rktId) === String(rktId) && a.title === rak.title) || [];
    let currentEmpIds = matchingActions.map((a: any) => Number(a.picEmployeeId)).filter(Boolean);
    const groupNums = groupEmployeeIds.map((id: any) => Number(id));
    if (assignAll) {
      currentEmpIds = [...new Set([...currentEmpIds, ...groupNums])];
    } else {
      currentEmpIds = currentEmpIds.filter((id: number) => !groupNums.includes(id));
    }
    await request("/api/work-plans", {
      kind: "sync-rak-inheritance",
      rktId,
      title: rak.title,
      description: rak.description || "",
      deadline: rak.deadline || "",
      responsibleUnit: rak.responsibleUnit || "",
      employeeIds: currentEmpIds,
    });
  };
  const buildPkFromInheritance = (
    targetEmployeeId: number | string,
    targetDocKey?: string,
    targetYear?: number,
    targetRktId?: number | string,
    targetActionId?: number | string
  ) => {
    const emp = (data.employees || plans.employees)?.find((e: any) => String(e.id) === String(targetEmployeeId));
    if (!emp) return null;

    let level = "Staf";
    const pos = (emp.position || "").toLowerCase();
    if (pos.includes("ketua")) level = "Ketua";
    else if (pos.includes("anggota") || pos.includes("komisioner")) level = "Anggota";
    else if (pos.includes("sekretaris")) level = "Sekretaris";
    else if (pos.includes("kasubag") || pos.includes("kepala sub")) level = "Subbag";

    const effectiveYear = Number(targetYear || form.year || year);

    // 1. Isolate documents to prevent cross-RKT or cross-year bleeding
    const targetDoc = targetDocKey ? plans.documents?.find((d: any) => d.documentKey === targetDocKey) : null;
    let candidateRows: any[] = [];
    let candidateActions: any[] = [];

    if (targetDoc) {
      candidateRows = targetDoc.rows || [];
      candidateActions = targetDoc.actions || [];
    } else {
      const yearDocs = (plans.documents || []).filter((d: any) => Number(d.year) === effectiveYear);
      if (yearDocs.length > 0) {
        candidateRows = yearDocs.flatMap((d: any) => d.rows || []);
        candidateActions = yearDocs.flatMap((d: any) => d.actions || []);
      } else {
        candidateRows = (data.rkt || []).filter((r: any) => Number(r.year) === effectiveYear);
        const candidateRktIds = new Set(candidateRows.map((r: any) => Number(r.id)));
        candidateActions = (data.actionPlans || []).filter((a: any) => candidateRktIds.has(Number(a.rktId)));
      }
    }

    // SPECIAL CASE: Exact single RKT row / RAK inheritance (when clicked on a specific RAK in the tree)
    if (targetRktId) {
      const targetRow = candidateRows.find((r: any) => Number(r.id) === Number(targetRktId))
        || (data.rkt || []).find((r: any) => Number(r.id) === Number(targetRktId))
        || (plans.documents || []).flatMap((d: any) => d.rows || []).find((r: any) => Number(r.id) === Number(targetRktId));

      if (targetRow) {
        const targetAction = targetActionId
          ? (candidateActions || data.actionPlans || []).find((a: any) => Number(a.id) === Number(targetActionId))
          : (candidateActions || data.actionPlans || []).find((a: any) => Number(a.rktId) === Number(targetRktId) && String(a.picEmployeeId) === String(targetEmployeeId));

        const objName = targetRow.strategicObjective || targetRow.objective || targetRow.programActivity || "Sasaran Kinerja";
        const ind = {
          indicator: targetRow.indicator || "Indikator Kinerja",
          target: targetRow.target || "100",
          unit: targetRow.unit || "%",
          targetDisplay: targetRow.unit ? `${targetRow.target} ${targetRow.unit}` : targetRow.target,
          sourceRktId: targetRow.id,
          sourceMapping: { objective: "strategicObjective", indicator: "indicator", target: "target" },
        };

        const progName = targetRow.programActivity || targetRow.objective || "Program KPU";
        const progBudget = Number(targetRow.budgetAmount || 0);
        const generatedObjectives = [{
          objective: objName,
          objectiveType: level === "Staf" ? "Sasaran Kegiatan" : "Sasaran Program (Outcome)",
          programActivity: progName,
          indicators: [ind],
        }];

        const generatedBudgets = [{
          programName: progName,
          outputDescription: targetAction?.title || (level === "Staf" ? (targetRow.indicator || "") : ""),
          amount: progBudget,
        }];

        const docYear = targetRow.year || targetYear || effectiveYear;

        return {
          documentKey: targetRow.documentKey || targetDocKey || "",
          year: docYear,
          employeeId: emp.id,
          agreementLevel: level,
          title: `Perjanjian Kinerja ${emp.fullName} - ${docYear}`,
          sourceType: targetRow.scope === "Kesekretariatan" ? "RKT Kesekretariatan" : "RKT Instansi",
          sourceRktId: targetRow.id,
          sourceActionPlanId: targetAction?.id || targetActionId || "",
          sourceDescription: targetAction 
            ? `Inheritance otomatis dari RAK: "${targetAction.title}" (${progName})`
            : `Inheritance otomatis dari RKT: "${targetRow.indicator}" (${progName})`,
          objectives: generatedObjectives,
          budgets: generatedBudgets,
          targetRktId: targetRow.id,
          targetActionId: targetAction?.id || targetActionId || "",
          inheritedCount: {
            objectives: 1,
            indicators: 1,
            actions: targetAction ? 1 : 0,
            docTitle: `${progName} (${docYear})`,
          },
        };
      }
    }

    // 2. Find actions assigned to this employee within the candidate pool
    const linkedActions = candidateActions.filter((a: any) => String(a.picEmployeeId) === String(targetEmployeeId));
    const linkedRktIds = new Set(linkedActions.map((a: any) => Number(a.rktId)).filter(Boolean));

    // 3. Find linked RKT indicator rows
    let linkedRktRows = candidateRows.filter((r: any) => linkedRktIds.has(Number(r.id)));

    // For Ketua:
    // If targeted to a specific Ketua document, Ketua inherits ALL rows of that document only!
    if (level === "Ketua") {
      if (targetDoc && targetDoc.rktType === "Ketua") {
        linkedRktRows = targetDoc.rows || [];
      } else if (!targetDoc && linkedRktRows.length === 0) {
        linkedRktRows = candidateRows.filter((r: any) => r.rktType === "Ketua" || r.scope === "Instansi");
      }
    }

    // For Sekretaris:
    // If targeted to a specific Sekretaris document, Sekretaris inherits ALL rows of that document only!
    if (level === "Sekretaris") {
      if (targetDoc && targetDoc.rktType === "Sekretaris") {
        linkedRktRows = targetDoc.rows || [];
      } else if (!targetDoc && linkedRktRows.length === 0) {
        linkedRktRows = candidateRows.filter((r: any) => r.rktType === "Sekretaris" || r.scope === "Kesekretariatan");
      }
    }

    // Group by strategic objective
    const objMap = new Map<string, any>();
    for (const row of linkedRktRows) {
      const objName = row.strategicObjective || row.objective || row.programActivity || "Sasaran Kinerja";
      if (!objMap.has(objName)) {
        objMap.set(objName, {
          objective: objName,
          objectiveType: level === "Staf" ? "Sasaran Kegiatan" : "Sasaran Program (Outcome)",
          programActivity: row.programActivity || "",
          indicators: [],
        });
      }
      const current = objMap.get(objName);
      current.indicators.push({
        indicator: row.indicator || "Indikator Kinerja",
        target: row.target || "100",
        unit: row.unit || "%",
        targetDisplay: row.unit ? `${row.target} ${row.unit}` : row.target,
        sourceRktId: row.id,
        sourceMapping: { objective: "strategicObjective", indicator: "indicator", target: "target" },
      });
    }

    // If no RKT rows found directly but employee has assigned actions in this scope
    if (objMap.size === 0 && linkedActions.length > 0) {
      for (const act of linkedActions) {
        objMap.set(act.title, {
          objective: act.title,
          objectiveType: level === "Staf" ? "Sasaran Kegiatan" : "Sasaran Program (Outcome)",
          programActivity: "Program Dukungan Manajemen dan Pelaksanaan Tugas Teknis Lainnya",
          indicators: [{
            indicator: `Ketercapaian pelaksanaan ${act.title}`,
            target: "100",
            unit: "%",
            targetDisplay: "100%",
            sourceRktId: act.rktId || "",
          }],
        });
      }
    }

    const generatedObjectives = objMap.size > 0 
      ? Array.from(objMap.values()) 
      : [blankObjective()];

    // Program activities for budgets
    const distinctPrograms = Array.from(new Set([
      ...Array.from(objMap.values()).map((o: any) => o.programActivity).filter(Boolean),
      ...linkedRktRows.map((r: any) => r.programActivity).filter(Boolean),
    ]));

    const generatedBudgets = distinctPrograms.length > 0
      ? distinctPrograms.map((pName: any) => {
          const matchingRow = candidateRows.find((r: any) => (r.programActivity || r.objective) === pName && Number(r.budgetAmount) > 0);
          return {
            programName: pName,
            outputDescription: level === "Staf" ? (linkedActions[0]?.title || "") : "",
            amount: Number(matchingRow?.budgetAmount || 0),
          };
        })
      : [blankBudget()];

    const firstRkt = linkedRktRows[0];
    const firstAction = linkedActions[0];
    const docYear = targetDoc ? targetDoc.year : effectiveYear;

    return {
      documentKey: targetDoc?.documentKey || targetDocKey || "",
      year: docYear,
      employeeId: emp.id,
      agreementLevel: level,
      title: `Perjanjian Kinerja ${emp.fullName} - ${docYear}`,
      sourceType: firstRkt?.scope === "Kesekretariatan" ? "RKT Kesekretariatan" : "RKT Instansi",
      sourceRktId: firstRkt?.id || "",
      sourceActionPlanId: firstAction?.id || "",
      sourceDescription: targetDoc 
        ? `Inheritance otomatis dari RKT (${targetDoc.rktType} · ${docYear}) & RAK terkait`
        : `Inheritance otomatis dari RKT & RAK Tahun ${docYear}`,
      objectives: generatedObjectives,
      budgets: generatedBudgets,
      targetRktId: firstRkt?.id || "",
      targetActionId: firstAction?.id || "",
      inheritedCount: {
        objectives: objMap.size,
        indicators: generatedObjectives.reduce((acc: number, o: any) => acc + o.indicators.length, 0),
        actions: linkedActions.length,
        docTitle: targetDoc ? `RKT ${targetDoc.rktType} (${docYear})` : `Tahun ${docYear}`,
      },
    };
  };
  const applyInheritanceToForm = (
    targetEmployeeId: number | string,
    targetDocKey?: string,
    targetYear?: number,
    targetRktId?: number | string,
    targetActionId?: number | string
  ) => {
    const res = buildPkFromInheritance(targetEmployeeId, targetDocKey, targetYear, targetRktId, targetActionId);
    if (!res) return;
    setForm((prev: any) => ({
      ...prev,
      _docKey: res.documentKey,
      _targetRktId: res.targetRktId,
      _targetActionId: res.targetActionId,
      year: res.year,
      employeeId: res.employeeId,
      agreementLevel: res.agreementLevel,
      title: res.title,
      sourceType: res.sourceType,
      sourceRktId: res.sourceRktId,
      sourceActionPlanId: res.sourceActionPlanId,
      sourceDescription: res.sourceDescription,
      objectives: res.objectives,
      budgets: res.budgets,
    }));
    setInheritedInfo(res.inheritedCount);
  };
  const setObjective = (objectiveIndex: number, key: string, value: any) =>
      setForm({ ...form, objectives: form.objectives.map((x: any, n: number) => n === objectiveIndex ? { ...x, [key]: value } : x) }),
    setNestedIndicator = (objectiveIndex: number, indicatorIndex: number, key: string, value: any) =>
      setForm({ ...form, objectives: form.objectives.map((objective: any, n: number) => n === objectiveIndex ? {
        ...objective, indicators: objective.indicators.map((indicator: any, k: number) => k === indicatorIndex ? { ...indicator, [key]: value } : indicator),
      } : objective) }),
    act = (id: number, action: string, extra: any = {}) =>
      request("/api/performance-agreements", { id, action, ...extra }, "PATCH");
  const rktValue = (r: any, key: string) =>
    key === "programActivity" ? (r.programActivity || r.objective) :
    key === "strategicObjective" ? (r.strategicObjective || r.objective) :
    key === "indicator" ? r.indicator : key === "target" ? r.target : "";
  const fillFromRkt = (objectiveIndex: number, indicatorIndex: number, rktId: string, mapping?: any) => {
    const r = data.rkt.find((x: any) => String(x.id) === String(rktId));
    const current = form.objectives[objectiveIndex].indicators[indicatorIndex];
    const m = mapping || current.sourceMapping;
    if (!r) return setNestedIndicator(objectiveIndex, indicatorIndex, "sourceRktId", rktId);
    setForm({
      ...form,
      sourceType: r.scope === "Kesekretariatan" ? "RKT Kesekretariatan" : "RKT Instansi",
      objectives: form.objectives.map((objective: any, n: number) => n === objectiveIndex ? {
        ...objective,
        objective: rktValue(r, m.objective),
        indicators: objective.indicators.map((indicator: any, k: number) => k === indicatorIndex ? {
          ...indicator, sourceRktId: rktId, sourceMapping: m,
          indicator: rktValue(r, m.indicator), target: rktValue(r, m.target),
          unit: m.target === "target" ? r.unit : "",
          targetDisplay: m.target === "target" ? `${r.target} ${r.unit || ""}`.trim() : rktValue(r, m.target),
        } : indicator),
      } : objective),
    });
  };
  const visible = data.agreements.filter(
      (a: any) => (filter === "Semua" || a.status === filter) && (pkTypeFilter === "Semua" || a.agreementLevel === pkTypeFilter),
    ),
    visibleRkt = (plans.documents || []).filter((r: any) => rktFilter === "Semua" || r.rktType === rktFilter),
    avg = visible.length
      ? Math.round(
          visible
            .flatMap((a: any) => a.indicators)
            .reduce((s: number, i: any) => s + i.progress, 0) /
            Math.max(1, visible.flatMap((a: any) => a.indicators).length),
        )
      : 0,
    monitorAgreements = data.agreements.filter((a:any) => (monevYearFilter === "Semua" || String(a.year) === monevYearFilter) && (monevUnitFilter === "Semua" || a.employee?.unitSubsection === monevUnitFilter)),
    monevPrintRows = monitorAgreements.flatMap((a:any) => a.evaluations.filter((e:any) => monevTypeFilter === "Semua" || e.periodType === monevTypeFilter).map((e:any) => ({ a, e, indicator: a.indicators.find((i:any) => i.id === e.indicatorId) })));
  return (
    <section className="pk-page">
      <div className="page-title">
        <div>
          <p>SINKRONISASI RKT–PK–E KINERJA</p>
          <h1>Perencanaan & Perjanjian Kinerja</h1>
          <span>
            Keterlacakan dari RKT, Rencana Aksi, cascading PK, PIC, realisasi,
            bukti dukung, dan riwayat perubahan.
          </span>
        </div>
        <div className="pk-head-actions">
          {plans.canManage && (
            <button onClick={() => { setSelectedKetuaProgram(""); setRktForm({ year, rktType: "Ketua", programs: [blankRktProgram()], policyOwnerId: plans.employees.find((e:any) => e.position === "Ketua")?.id || "", notes: "", status: "Aktif", documentKey: undefined }); setShowRkt(true); }}>+ RKT</button>
          )}
          <button className="primary" onClick={() => {
            const initialEmpId = form.employeeId || data.selfEmployeeId || data.employees?.[0]?.id;
            if (initialEmpId) applyInheritanceToForm(initialEmpId, undefined, Number(form.year || year));
            setEditing(null);
            setShowPk(true);
          }}>
            + Buat PK
          </button>
        </div>
      </div>
      <div className="pk-tabs">
        <button
          className={tab === "rkt" ? "active" : ""}
          onClick={() => setTab("rkt")}
        >
          RKT & Rencana Aksi
        </button>
        <button
          className={tab === "pk" ? "active" : ""}
          onClick={() => setTab("pk")}
        >
          Cascading PK
        </button>
        <button
          className={tab === "monitor" ? "active" : ""}
          onClick={() => setTab("monitor")}
        >
          Monitoring Realisasi
        </button>
      </div>
      {tab === "rkt" && (
        <>
          <div className="pk-summary">
            <article>
              <b>{visibleRkt.length}</b>
              <span>Total RKT</span>
            </article>
            <article>
              <b>{visibleRkt.reduce((sum: number, r: any) => sum + r.actions.length, 0)}</b>
              <span>Total Rencana Aksi</span>
            </article>
            <article>
              <b>{visibleRkt.reduce((sum: number, r: any) => sum + r.programs.length, 0)}</b>
              <span>Total Program</span>
            </article>
            <article>
              <b>{visibleRkt.reduce((sum: number, r: any) => sum + r.rows.length, 0)}</b>
              <span>Total Indikator</span>
            </article>
          </div>
          <div className="pk-filter">
            <label>
              Jenis RKT
              <select value={rktFilter} onChange={(e) => setRktFilter(e.target.value)}>
                {["Semua", "Ketua", "Sekretaris"].map((x) => <option key={x}>{x}</option>)}
              </select>
            </label>
          </div>
          <div className="rkt-list">
            {visibleRkt.length ? (
              visibleRkt.map((r: any) => (
              <article key={r.documentKey}>
                <div className="pk-card-head">
                  <div>
                    <span>
                      RKT {r.rktType.toUpperCase()} · {r.year}
                    </span>
                    <h3>{r.programs.length} Program/Kegiatan · {r.programs.reduce((s:number,p:any) => s + p.objectives.length, 0)} Sasaran</h3>
                    <p>{r.rktType === "Ketua" ? "Sasaran Strategis" : "Sasaran Program (Outcome) / Sasaran Kegiatan"} · {r.rows.length} indikator</p>
                  </div>
                  <i className={`pk-status ${r.status.toLowerCase()}`}>
                    {r.status}
                  </i>
                </div>
                <div className="pk-meta">
                  <span>
                    Penanggung jawab kebijakan{" "}
                    <b>{r.owner?.fullName || "Belum ditentukan"}</b>
                  </span>
                  <span>
                    Rencana Aksi <b>{r.actions.length}</b>
                  </span>
                </div>
                <div className="rkt-hierarchy">{r.programs.map((p:any, pn:number) => <div key={pn}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px", flexWrap: "wrap", gap: "6px" }}>
                    <b>{pn + 1}. {p.programActivity}</b>
                    {Number(p.budgetAmount) > 0 && (
                      <span style={{ fontSize: "9px", background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0", padding: "1px 8px", borderRadius: "10px", fontWeight: 700 }}>
                        Pagu: {rupiah(Number(p.budgetAmount))}
                      </span>
                    )}
                  </div>
                  {p.objectives.map((o:any, on:number) => <section key={on}><strong>{pn + 1}.{on + 1} {o.objective}</strong>
                    {o.indicators.map((i:any, ix:number) => {
                      const indActions = r.actions.filter((a: any) => String(a.rktId) === String(i.id));
                      const distinctActionTitles = Array.from(new Set(indActions.map((a: any) => a.title)));

                      return (
                        <div key={i.id} style={{ marginTop: "6px", marginBottom: "6px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                            <span style={{ margin: 0, fontWeight: 600, color: "#334155" }}>
                              {pn + 1}.{on + 1}.{ix + 1} {i.indicator} · Target {i.target} {i.unit}
                            </span>
                            {plans.canManage && (
                              <button
                                type="button"
                                style={{ fontSize: "8px", padding: "1px 6px", border: "1px solid #cfe0da", borderRadius: "4px", background: "#fff", color: "#168765", cursor: "pointer", flexShrink: 0 }}
                                onClick={() => {
                                  const defaultPicId = r.policyOwnerId || (r.rktType === "Sekretaris" ? plans.employees?.find((e: any) => e.position === "Sekretaris")?.id : plans.employees?.find((e: any) => e.position === "Ketua")?.id) || "";
                                  setActionForm(blankActionForm(String(i.id), defaultPicId));
                                  setShowAction(true);
                                }}
                              >
                                + RAK Indikator
                              </button>
                            )}
                          </div>
                          {distinctActionTitles.map((title: any, actIdx: number) => {
                        const sharedActions = indActions.filter((a: any) => a.title === title);
                        const firstAct = sharedActions[0];
                        const assignedEmpIds = sharedActions.map((a: any) => String(a.picEmployeeId)).filter(Boolean);
                        const assignedEmployees = (plans.employees || []).filter((e: any) => assignedEmpIds.includes(String(e.id)));
                        const treeKey = `${r.documentKey}-${firstAct.rktId}-${title}`;
                        const isExpanded = Boolean(expandedRakTree[treeKey]);

                        // Group employees into organization hierarchy
                        const allEmps = plans.employees || [];
                        const ketuaEmps = allEmps.filter((e: any) => e.position === "Ketua");
                        const anggotaEmps = allEmps.filter((e: any) => e.position === "Anggota");
                        const sekretarisEmps = allEmps.filter((e: any) => e.position === "Sekretaris");
                        const subbagUnits = Array.from(new Set(allEmps.filter((e: any) => e.position !== "Ketua" && e.position !== "Anggota" && e.position !== "Sekretaris").map((e: any) => e.unit || "Lainnya"))).sort();

                        return (
                          <div key={actIdx} style={{ marginLeft: "1rem", padding: "0.5rem 0.75rem", background: "#f8fafc", borderLeft: "4px solid #3b82f6", marginTop: "0.5rem", borderRadius: "0 8px 8px 0" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", flexWrap: "wrap" }}>
                              <div>
                                <span style={{ fontSize: "10px", color: "#0f172a", display: "inline-block" }}>
                                  <b>RAK:</b> {firstAct.title}{" "}
                                  <span style={{ fontSize: "9px", color: "#64748b", display: "inline" }}>(Batas Waktu: {firstAct.deadline || "—"})</span>
                                </span>
                                {firstAct.description && (
                                  <span style={{ color: "#64748b", display: "block", fontSize: "9px", marginTop: "2px" }}>
                                    {firstAct.description}
                                  </span>
                                )}
                              </div>
                              <span style={{ fontSize: "8px", background: assignedEmployees.length ? "#e0f2fe" : "#f1f5f9", color: assignedEmployees.length ? "#0369a1" : "#64748b", padding: "2px 8px", borderRadius: "10px", fontWeight: 700, display: "inline-block" }}>
                                {assignedEmployees.length} PIC Terdistribusi
                              </span>
                            </div>

                            <div style={{ marginTop: "0.35rem", fontSize: "9px", color: "#475569" }}>
                              <b style={{ display: "inline" }}>PIC Aktif:</b>{" "}
                              <span style={{ display: "inline", color: assignedEmployees.length ? "#334155" : "#94a3b8" }}>
                                {assignedEmployees.length ? assignedEmployees.map((e: any) => `${e.fullName} (${e.position}${e.unit ? ` - ${e.unit}` : ""})`).join(", ") : "Belum ada PIC ditugaskan"}
                              </span>
                            </div>

                            {plans.canManage && (
                              <div className="row-actions" style={{ marginTop: "0.4rem", justifyContent: "flex-start", alignItems: "center", gap: "6px" }}>
                                <button
                                  style={{ background: isExpanded ? "#1e293b" : "#fff", color: isExpanded ? "#fff" : "#168765", borderColor: isExpanded ? "#1e293b" : "#cfe0da", fontWeight: 600, fontSize: "9px", padding: "4px 8px" }}
                                  onClick={() => setExpandedRakTree((prev) => ({ ...prev, [treeKey]: !prev[treeKey] }))}
                                >
                                  {isExpanded ? "▲ Tutup Inheritance PIC" : `▼ Inheritance ke Hirarki Organisasi (${assignedEmployees.length})`}
                                </button>
                                <button style={{ fontSize: "9px", padding: "4px 8px" }} onClick={() => { setActionForm({ ...firstAct, rktId: firstAct.rktId }); setShowAction(true); }}>Edit</button>
                                <button style={{ fontSize: "9px", padding: "4px 8px" }} className="danger" onClick={() => {
                                  if (confirm(`Hapus seluruh rencana aksi "${title}" (${sharedActions.length} data)?`)) {
                                    Promise.all(sharedActions.map((a: any) => request(`/api/work-plans?actionId=${a.id}`, {}, "DELETE")));
                                  }
                                }}>Hapus</button>
                              </div>
                            )}

                            {/* Organization Tree Section */}
                            {isExpanded && plans.canManage && (
                              <div style={{ marginTop: "0.6rem", padding: "0.6rem 0.75rem", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "7px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem", borderBottom: "1px solid #e2e8f0", paddingBottom: "0.4rem" }}>
                                  <div>
                                    <b style={{ fontSize: "10px", color: "#0f172a" }}>Struktur Organisasi (Checklist Inheritance)</b>
                                    <p style={{ margin: "2px 0 0", fontSize: "8.5px", color: "#64748b" }}>Centang pegawai yang mewarisi RAK & elemen sasaran ini. Perubahan langsung tersinkronisasi otomatis.</p>
                                  </div>
                                </div>

                                <div style={{ display: "grid", gap: "0.4rem", fontSize: "9px" }}>
                                  {/* Lembaga / Ketua */}
                                  <div style={{ padding: "0.35rem 0.5rem", background: "#f8fafc", borderRadius: "5px", border: "1px solid #e2e8f0" }}>
                                    <div style={{ fontWeight: 700, color: "#166534", marginBottom: "0.25rem", fontSize: "9px" }}>● Lembaga / Ketua</div>
                                    {ketuaEmps.map((emp: any) => {
                                      const isAssigned = assignedEmpIds.includes(String(emp.id));
                                      return (
                                        <div key={emp.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", marginLeft: "0.75rem", marginTop: "2px" }}>
                                          <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "9px" }}>
                                            <input type="checkbox" checked={isAssigned} onChange={() => toggleRakInheritance(Number(firstAct.rktId), firstAct, emp.id, isAssigned)} />
                                            <span style={{ display: "inline" }}><b>{emp.fullName}</b> <span style={{ color: "#64748b", display: "inline" }}>({emp.position})</span></span>
                                          </label>
                                          {isAssigned && (
                                            <button
                                              type="button"
                                              title={`Buat PK untuk ${emp.fullName} dari RKT & RAK ini`}
                                              style={{ fontSize: "8px", padding: "1px 6px", background: "#ecfdf5", color: "#047857", border: "1px solid #a7f3d0", borderRadius: "3px", cursor: "pointer", fontWeight: 600 }}
                                              onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setEditing(null);
                                                applyInheritanceToForm(emp.id, r.documentKey, r.year, firstAct.rktId, firstAct.id);
                                                setShowPk(true);
                                              }}
                                            >
                                              ⚡ Buat PK
                                            </button>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>

                                  {/* Komisioner / Anggota */}
                                  <div style={{ padding: "0.35rem 0.5rem", background: "#f8fafc", borderRadius: "5px", border: "1px solid #e2e8f0" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                                      <span style={{ fontWeight: 700, color: "#1e40af", fontSize: "9px", display: "inline" }}>↳ Komisioner (Anggota)</span>
                                      <button
                                        style={{ fontSize: "8px", padding: "2px 6px", border: "1px solid #cbd5e1", borderRadius: "4px", background: "#fff", cursor: "pointer" }}
                                        onClick={() => batchAssignRakGroup(Number(firstAct.rktId), firstAct, anggotaEmps.map((e: any) => e.id), !anggotaEmps.every((e: any) => assignedEmpIds.includes(String(e.id))))}
                                      >
                                        {anggotaEmps.every((e: any) => assignedEmpIds.includes(String(e.id))) ? "Batal Semua Anggota" : "Pilih Semua Anggota"}
                                      </button>
                                    </div>
                                    {anggotaEmps.map((emp: any) => {
                                      const isAssigned = assignedEmpIds.includes(String(emp.id));
                                      return (
                                        <div key={emp.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", marginLeft: "0.75rem", marginTop: "3px" }}>
                                          <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "9px" }}>
                                            <input type="checkbox" checked={isAssigned} onChange={() => toggleRakInheritance(Number(firstAct.rktId), firstAct, emp.id, isAssigned)} />
                                            <span style={{ display: "inline" }}><b>{emp.fullName}</b> <span style={{ color: "#64748b", display: "inline" }}>({emp.position})</span></span>
                                          </label>
                                          {isAssigned && (
                                            <button
                                              type="button"
                                              title={`Buat PK untuk ${emp.fullName} dari RKT & RAK ini`}
                                              style={{ fontSize: "8px", padding: "1px 6px", background: "#ecfdf5", color: "#047857", border: "1px solid #a7f3d0", borderRadius: "3px", cursor: "pointer", fontWeight: 600 }}
                                              onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setEditing(null);
                                                applyInheritanceToForm(emp.id, r.documentKey, r.year, firstAct.rktId, firstAct.id);
                                                setShowPk(true);
                                              }}
                                            >
                                              ⚡ Buat PK
                                            </button>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>

                                  {/* Sekretariat / Sekretaris */}
                                  <div style={{ padding: "0.35rem 0.5rem", background: "#f8fafc", borderRadius: "5px", border: "1px solid #e2e8f0" }}>
                                    <div style={{ fontWeight: 700, color: "#854d0e", marginBottom: "0.25rem", fontSize: "9px" }}>↳ Sekretariat (Sekretaris)</div>
                                    {sekretarisEmps.map((emp: any) => {
                                      const isAssigned = assignedEmpIds.includes(String(emp.id));
                                      return (
                                        <div key={emp.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", marginLeft: "0.75rem", marginTop: "3px" }}>
                                          <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "9px" }}>
                                            <input type="checkbox" checked={isAssigned} onChange={() => toggleRakInheritance(Number(firstAct.rktId), firstAct, emp.id, isAssigned)} />
                                            <span style={{ display: "inline" }}><b>{emp.fullName}</b> <span style={{ color: "#64748b", display: "inline" }}>({emp.position})</span></span>
                                          </label>
                                          {isAssigned && (
                                            <button
                                              type="button"
                                              title={`Buat PK untuk ${emp.fullName} dari RKT & RAK ini`}
                                              style={{ fontSize: "8px", padding: "1px 6px", background: "#ecfdf5", color: "#047857", border: "1px solid #a7f3d0", borderRadius: "3px", cursor: "pointer", fontWeight: 600 }}
                                              onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setEditing(null);
                                                applyInheritanceToForm(emp.id, r.documentKey, r.year, firstAct.rktId, firstAct.id);
                                                setShowPk(true);
                                              }}
                                            >
                                              ⚡ Buat PK
                                            </button>
                                          )}
                                        </div>
                                      );
                                    })}

                                    {/* Subbagian-subbagian di bawah Sekretariat */}
                                    <div style={{ marginTop: "0.35rem", marginLeft: "0.75rem", display: "grid", gap: "0.35rem" }}>
                                      {subbagUnits.map((subbag: string) => {
                                        const subbagEmps = allEmps.filter((e: any) => (e.unit || "Lainnya") === subbag && e.position !== "Ketua" && e.position !== "Anggota" && e.position !== "Sekretaris");
                                        const allChecked = subbagEmps.length > 0 && subbagEmps.every((e: any) => assignedEmpIds.includes(String(e.id)));

                                        return (
                                          <div key={subbag} style={{ background: "#ffffff", padding: "0.3rem 0.5rem", borderRadius: "5px", border: "1px solid #e2e8f0" }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.2rem" }}>
                                              <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "9px", display: "inline" }}>↳ {subbag}</span>
                                              <button
                                                style={{ fontSize: "8px", padding: "1px 5px", border: "1px solid #cbd5e1", borderRadius: "4px", background: "#fff", cursor: "pointer" }}
                                                onClick={() => batchAssignRakGroup(Number(firstAct.rktId), firstAct, subbagEmps.map((e: any) => e.id), !allChecked)}
                                              >
                                                {allChecked ? `Batal Semua ${subbag}` : `Pilih Semua ${subbag}`}
                                              </button>
                                            </div>
                                            <div style={{ marginLeft: "0.75rem", display: "grid", gap: "2px" }}>
                                              {subbagEmps.map((emp: any) => {
                                                const isAssigned = assignedEmpIds.includes(String(emp.id));
                                                return (
                                                  <div key={emp.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", marginTop: "2px" }}>
                                                    <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "9px" }}>
                                                      <input type="checkbox" checked={isAssigned} onChange={() => toggleRakInheritance(Number(firstAct.rktId), firstAct, emp.id, isAssigned)} />
                                                      <span style={{ display: "inline" }}><b>{emp.fullName}</b> <span style={{ color: "#64748b", display: "inline" }}>({emp.position})</span></span>
                                                    </label>
                                                    {isAssigned && (
                                                      <button
                                                        type="button"
                                                        title={`Buat PK untuk ${emp.fullName} dari RKT & RAK ini`}
                                                        style={{ fontSize: "8px", padding: "1px 6px", background: "#ecfdf5", color: "#047857", border: "1px solid #a7f3d0", borderRadius: "3px", cursor: "pointer", fontWeight: 600 }}
                                                        onClick={(e) => {
                                                          e.preventDefault();
                                                          e.stopPropagation();
                                                          setEditing(null);
                                                          applyInheritanceToForm(emp.id, r.documentKey, r.year, firstAct.rktId, firstAct.id);
                                                          setShowPk(true);
                                                        }}
                                                      >
                                                        ⚡ Buat PK
                                                      </button>
                                                    )}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </section>)}
                </div>)}</div>
                {plans.canManage && <div className="row-actions">
                  <button className="secondary-action" onClick={() => {
                    const defaultPicId = r.policyOwnerId || (r.rktType === "Sekretaris" ? plans.employees?.find((e: any) => e.position === "Sekretaris")?.id : plans.employees?.find((e: any) => e.position === "Ketua")?.id) || "";
                    setActionForm(blankActionForm(r.rows[0]?.id || "", defaultPicId));
                    setShowAction(true);
                  }}>+ Rencana Aksi</button>
                  <button onClick={() => { setRktForm({ documentKey: r.documentKey, year: r.year, rktType: r.rktType, policyOwnerId: r.policyOwnerId || "", notes: r.notes || "", status: r.status, programs: r.programs }); setShowRkt(true); }}>Edit</button>
                  {data.canManageAll && <button className="danger" onClick={() => request(`/api/work-plans?documentKey=${encodeURIComponent(r.documentKey)}`, {}, "DELETE")}>Hapus</button>}
                </div>}
              </article>
            ))
          ) : (
            <div className="report-empty">
              Belum ada RKT Instansi atau RKT Kesekretariatan.
            </div>
          )}
        </div>
        </>
      )}
      {tab === "pk" && (
        <>
          <div className="pk-summary">
            <article>
              <b>{data.agreements.length}</b>
              <span>Total PK</span>
            </article>
            <article>
              <b>
                {
                  data.agreements.filter((a: any) => a.status === "Draft")
                    .length
                }
              </b>
              <span>Dalam penyusunan</span>
            </article>
            <article>
              <b>
                {
                  data.agreements.filter((a: any) => a.status === "Disetujui")
                    .length
                }
              </b>
              <span>Dokumen final</span>
            </article>
            <article>
              <b>{avg}%</b>
              <span>Rata-rata progres</span>
            </article>
          </div>
          <div className="pk-filter">
            <label>
              Level / Tipe
              <select value={pkTypeFilter} onChange={(e) => setPkTypeFilter(e.target.value)}>
                {["Semua", "Ketua", "Anggota", "Sekretaris", "Subbag", "Staf"].map((x) => <option key={x}>{x}</option>)}
              </select>
            </label>
            <label>
              Status
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                {[
                  "Semua",
                  "Draft",
                  "Disetujui",
                ].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="pk-list">
            {visible.length ? (
              visible.map((a: any) => (
                <article key={a.id}>
                  <div className="pk-card-head">
                    <div>
                      <span>
                        {a.agreementLevel} · PK {a.year} · VERSI {a.version}
                      </span>
                      <h3>{a.title}</h3>
                      <p>
                        {a.employee?.fullName} ·{" "}
                        {a.employee?.position || a.employee?.unitSubsection}
                      </p>
                    </div>
                    <i className={`pk-status ${a.status.toLowerCase()}`}>
                      {a.status}
                    </i>
                  </div>
                  <div className="trace-line">
                    <b>Sumber:</b> {a.sourceType}
                    {a.sourceRkt ? ` → ${a.sourceRkt.objective}` : ""}
                    {a.sourceAction ? ` → ${a.sourceAction.title}` : ""}
                    {a.parent ? ` → Turunan PK #${a.parent.id}` : ""}
                  </div>
                  <div className="pk-meta">
                    <span>
                      Jalur atasan{" "}
                      <b>{a.supervisor?.fullName || "Belum ditentukan"}</b>
                    </span>
                    <span>
                      Koordinasi substantif{" "}
                      <b>{a.commissioner?.fullName || "—"}</b>
                    </span>
                    <span>
                      Indikator <b>{a.indicators.length}</b>
                    </span>
                  </div>
                  <div className="pk-indicators">
                    {a.objectives.map((objective: any, n: number) => <div key={`${objective.objectiveGroup}-${objective.objective}`}>
                      <b>{n + 1}. {objective.objective}</b>
                      {objective.indicators.map((i: any, k: number) => <span key={i.id}>
                        {n + 1}.{k + 1} {i.indicator} · Target {i.targetDisplay || `${i.target} ${i.unit}`} · Progres {i.progress}%
                      </span>)}
                    </div>)}
                  </div>
                  <div className="pk-budget-summary">
                    <div><b>{a.agreementLevel === "Staf" ? "Alokasi Anggaran Output" : "Anggaran Program"}</b><strong>{rupiah(a.budgetTotal)}</strong></div>
                    {a.budgets.map((budget:any) => <section key={budget.id}>
                      <span><b>{budget.programName}</b>{budget.outputDescription ? ` · ${budget.outputDescription}` : ""}</span>
                      <span>{rupiah(budget.amount)}</span>
                      {budget.confirmationStatus !== "Tidak Perlu" && <i className={`budget-status ${budget.confirmationStatus === "Dikonfirmasi" ? "confirmed" : ""}`}>{budget.confirmationStatus}</i>}
                      {a.agreementLevel === "Staf" && budget.confirmationStatus === "Belum Dikonfirmasi" && (data.canManageAll || a.supervisor?.id === data.currentEmployee?.id) && <button onClick={() => act(a.id, "confirm-budget", { budgetId: budget.id })}>Konfirmasi Alokasi</button>}
                    </section>)}
                  </div>
                  {a.revisionNotes && (
                    <p className="revision-note">Revisi: {a.revisionNotes}</p>
                  )}
                  <div className="row-actions">
                    {a.status === "Draft" && <button onClick={() => act(a.id, "finalize")}>Tetapkan Final</button>}
                    {a.status === "Draft" && <button onClick={() => {
                      setForm({ ...a, employeeId: a.employeeId, objectives: a.objectives.map((objective:any) => ({ ...objective, indicators: objective.indicators.map((i:any) => ({ ...i, sourceRktId: i.sourceRktId || "", sourceMapping: typeof i.sourceMapping === "string" ? JSON.parse(i.sourceMapping || "{}") : i.sourceMapping })) })) });
                      setEditing({ type: "edit-pk", id: a.id }); setShowPk(true);
                    }}>Edit</button>}
                    <button
                      onClick={() => {
                        setEditing(a);
                        setTimeout(() => window.print(), 50);
                      }}
                    >
                      Cetak PK
                    </button>
                    {a.status === "Disetujui" && <button onClick={() => {
                      const notes = prompt("Alasan perubahan dokumen:", "Perubahan dokumen");
                      if (notes) act(a.id, "revise", { notes });
                    }}>Buat Perubahan</button>}
                    {a.status === "Draft" && (
                      <button
                        className="danger"
                        onClick={() =>
                          request(
                            `/api/performance-agreements?id=${a.id}`,
                            {},
                            "DELETE",
                          )
                        }
                      >
                        Hapus
                      </button>
                    )}
                  </div>
                </article>
              ))
            ) : (
              <div className="report-empty">Belum ada PK pada filter ini.</div>
            )}
          </div>
        </>
      )}
      {tab === "monitor" && (
        <div>
          <div className="monev-filters">
            <label>Tahun<select value={monevYearFilter} onChange={(e) => setMonevYearFilter(e.target.value)}><option>Semua</option>{[...new Set(data.agreements.map((a:any) => String(a.year)))].map((x:any) => <option key={x}>{x}</option>)}</select></label>
            <label>Periode<select value={monevTypeFilter} onChange={(e) => setMonevTypeFilter(e.target.value)}><option>Semua</option><option>Bulanan</option><option>Triwulanan</option><option>Tahunan</option></select></label>
            <label>Unit/Subbagian<select value={monevUnitFilter} onChange={(e) => setMonevUnitFilter(e.target.value)}><option>Semua</option>{[...new Set(data.agreements.map((a:any) => a.employee?.unitSubsection).filter(Boolean))].map((x:any) => <option key={x}>{x}</option>)}</select></label>
            <button onClick={() => { setEditing({ type: "print-monev", rows: monevPrintRows }); setTimeout(() => window.print(), 50); }}>Cetak Rekap Monev</button>
          </div>
          <div className="monitor-pk-list">
          {monitorAgreements
            .flatMap((a: any) => a.indicators.map((i: any) => ({ a, i })))
            .map(({ a, i }: any) => (
              <article key={i.id}>
                <div>
                  <span>
                    {a.employee?.fullName} · {a.agreementLevel}
                  </span>
                  <h3>{i.objective}</h3>
                  <p>
                    {i.indicator} · Target {i.target} {i.unit}
                  </p>
                </div>
                <div className="monitor-values">
                  <b>{i.progress}%</b>
                  <span>Data monitoring</span>
                </div>
                <div className="progress">
                  <i style={{ width: `${i.progress}%` }} />
                </div>
                <div className="monitor-detail">
                  <span>Realisasi output terakhir: {i.realization || "Belum diisi"}</span>
                  <span>Riwayat Monev: {a.evaluations.filter((e:any) => e.indicatorId === i.id && (monevTypeFilter === "Semua" || e.periodType === monevTypeFilter)).length}</span>
                </div>
                <div className="row-actions">
                  {(data.canManageAll || a.employeeId === data.currentEmployee?.id) && <button onClick={() => setEditing({ type: "monev", agreement: a, indicator: i, form: blankMonev() })}>+ Tambah Monev</button>}
                </div>
                <div className="monev-history">{a.evaluations.filter((e:any) => e.indicatorId === i.id && (monevTypeFilter === "Semua" || e.periodType === monevTypeFilter)).map((e:any) => <section key={e.id}>
                  <header><b>{e.periodType} · {periodDetails(e.periodType, e.periodKey).evaluated}</b><strong>{e.progress}%</strong></header>
                  <p><b>Waktu pengisian:</b> {periodDetails(e.periodType, e.periodKey).submitted}</p>
                  <div><span>Realisasi Anggaran</span><b>{rupiah(e.budgetRealization)}</b></div>
                  <p><b>Realisasi Output:</b> {e.outputRealization || "—"}</p><p><b>Permasalahan:</b> {e.problemIdentification || "—"}</p><p><b>Upaya Peningkatan:</b> {e.improvementEffort || "—"}</p><p><b>Kegiatan:</b> {e.completedActivities || "—"}</p><p><b>Keterangan:</b> {e.notes || "—"}</p>
                  {!!e.evidenceLinks.length && <div className="monev-links">{e.evidenceLinks.map((link:string,n:number) => <a href={link} target="_blank" rel="noreferrer" key={n}>Bukti {n + 1}</a>)}</div>}
                  {(data.canManageAll || a.employeeId === data.currentEmployee?.id) && <div className="row-actions"><button onClick={() => setEditing({ type: "monev", agreement: a, indicator: i, form: { ...e, evidenceLinks: e.evidenceLinks.length ? e.evidenceLinks : [""] } })}>Edit</button><button className="danger" onClick={() => request(`/api/performance-evaluations?id=${e.id}`, {}, "DELETE")}>Hapus</button></div>}
                </section>)}</div>
              </article>
            ))}
          </div>
        </div>
      )}
      {showPk && (
        <div className="modal-backdrop">
          <div className="modal pk-modal">
            <span>PK BERJENJANG</span>
            <h3>{editing?.type === "edit-pk" ? "Edit Perjanjian Kinerja" : "Buat Perjanjian Kinerja"}</h3>
            <div className="module-form">
              {inheritedInfo && (
                <div style={{ padding: "8px 12px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "6px", fontSize: "9px", color: "#166534", marginBottom: "10px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                  <span>
                    ✓ <b>Terisi Otomatis dari {inheritedInfo.docTitle || "RKT & RAK"}:</b> Terdeteksi {inheritedInfo.actions} RAK & {inheritedInfo.indicators} Indikator Kinerja ({inheritedInfo.objectives} Sasaran). Komponen sasaran & nama program telah siap, silakan lengkapi <b>Alokasi Anggaran</b> di bawah.
                  </span>
                  <button
                    type="button"
                    style={{ fontSize: "8px", padding: "2px 8px", border: "1px solid #86efac", background: "#fff", borderRadius: "4px", color: "#15803d", cursor: "pointer", fontWeight: 600, flexShrink: 0 }}
                    onClick={() => applyInheritanceToForm(form.employeeId, form._docKey, Number(form.year || year), form._targetRktId, form._targetActionId)}
                  >
                    Tarik Ulang
                  </button>
                </div>
              )}
              {data.canManageAll && (
                <label>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3px" }}>
                    <span>Pegawai</span>
                    <button
                      type="button"
                      style={{ fontSize: "8px", padding: "2px 6px", background: "#e0f2fe", color: "#0369a1", border: "1px solid #bae6fd", borderRadius: "3px", cursor: "pointer", fontWeight: 600 }}
                      onClick={() => applyInheritanceToForm(form.employeeId, form._docKey, Number(form.year || year), form._targetRktId, form._targetActionId)}
                    >
                      ⚡ Tarik dari RKT & RAK
                    </button>
                  </div>
                  <select
                    value={form.employeeId}
                    onChange={(e) => {
                      const nextEmpId = e.target.value;
                      applyInheritanceToForm(nextEmpId, form._docKey, Number(form.year || year), form._targetRktId, form._targetActionId);
                    }}
                  >
                    {data.employees.map((e: any) => (
                      <option value={e.id} key={e.id}>
                        {e.fullName} · {e.position}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="pk-form-grid">
                <label>
                  Level PK
                  <select
                    value={form.agreementLevel}
                    onChange={(e) =>
                      setForm({ ...form, agreementLevel: e.target.value })
                    }
                  >
                    {["Ketua", "Anggota", "Sekretaris", "Subbag", "Staf"].map(
                      (x) => (
                        <option key={x}>{x}</option>
                      ),
                    )}
                  </select>
                </label>
                <label>
                  Sumber Sasaran
                  <select
                    value={form.sourceType}
                    onChange={(e) =>
                      setForm({ ...form, sourceType: e.target.value })
                    }
                  >
                    {sources.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
                <label>
                  RKT terkait (opsional)
                  <input type="text" placeholder="Ketik untuk mencari RKT..." value={form._searchRkt || ""} onChange={(e) => setForm({...form, _searchRkt: e.target.value})} style={{marginBottom: "4px"}} />
                  <select
                    value={form.sourceRktId}
                    onChange={(e) =>
                      setForm({ ...form, sourceRktId: e.target.value })
                    }
                  >
                    <option value="">Tidak terkait langsung</option>
                    {data.rkt.filter((x:any) => !form._searchRkt || `${x.scope} ${x.objective}`.toLowerCase().includes(form._searchRkt.toLowerCase())).map((x: any) => (
                      <option value={x.id} key={x.id}>
                        {x.scope} · {x.objective}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Rencana Aksi terkait
                  <input type="text" placeholder="Ketik untuk mencari Rencana Aksi..." value={form._searchRak || ""} onChange={(e) => setForm({...form, _searchRak: e.target.value})} style={{marginBottom: "4px"}} />
                  <select
                    value={form.sourceActionPlanId}
                    onChange={(e) =>
                      setForm({ ...form, sourceActionPlanId: e.target.value })
                    }
                  >
                    <option value="">Tidak ada</option>
                    {data.actionPlans.filter((x:any) => !form._searchRak || x.title.toLowerCase().includes(form._searchRak.toLowerCase())).map((x: any) => (
                      <option value={x.id} key={x.id}>
                        {x.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  PK induk/cascading
                  <input type="text" placeholder="Ketik untuk mencari PK..." value={form._searchPk || ""} onChange={(e) => setForm({...form, _searchPk: e.target.value})} style={{marginBottom: "4px"}} />
                  <select
                    value={form.parentAgreementId}
                    onChange={(e) =>
                      setForm({ ...form, parentAgreementId: e.target.value })
                    }
                  >
                    <option value="">PK mandiri</option>
                    {data.agreements.filter((x:any) => !form._searchPk || `${x.employee?.fullName} ${x.title} ${x.sourceRkt?.objective} ${x.objectives?.[0]?.objective}`.toLowerCase().includes(form._searchPk.toLowerCase())).map((x: any) => (
                      <option value={x.id} key={x.id}>
                        #{x.id} {x.employee?.fullName} · {x.title} (Sasaran: {x.sourceRkt?.objective || x.objectives?.[0]?.objective || "—"})
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Koordinator substantif Anggota
                  <select
                    value={form.coordinationCommissionerId}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        coordinationCommissionerId: e.target.value,
                      })
                    }
                  >
                    <option value="">Tidak ada</option>
                    {data.employees
                      .filter((e: any) => e.position === "Anggota")
                      .map((e: any) => (
                        <option value={e.id} key={e.id}>
                          {e.fullName}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Tahun
                  <input
                    type="number"
                    value={form.year}
                    onChange={(e) => setForm({ ...form, year: e.target.value })}
                  />
                </label>
                <label>
                  Judul
                  <input
                    value={form.title}
                    onChange={(e) =>
                      setForm({ ...form, title: e.target.value })
                    }
                  />
                </label>
                <label>
                  Mulai
                  <input
                    type="date"
                    value={form.periodStart}
                    onChange={(e) =>
                      setForm({ ...form, periodStart: e.target.value })
                    }
                  />
                </label>
                <label>
                  Selesai
                  <input
                    type="date"
                    value={form.periodEnd}
                    onChange={(e) =>
                      setForm({ ...form, periodEnd: e.target.value })
                    }
                  />
                </label>
              </div>
              <label>
                Keterangan asal sasaran
                <textarea
                  rows={2}
                  value={form.sourceDescription}
                  onChange={(e) =>
                    setForm({ ...form, sourceDescription: e.target.value })
                  }
                  placeholder="Jelaskan keterkaitan tupoksi, regulasi, bidang Anggota, atau penugasan khusus."
                />
              </label>
              <div className="pk-form-indicators">
                <div>
                  <b>Sasaran dan Indikator</b>
                  <button onClick={() => setForm({ ...form, objectives: [...form.objectives, blankObjective()] })}>+ Sasaran</button>
                </div>
                {form.objectives.map((objective: any, objectiveIndex: number) => <section className="pk-objective-editor" key={objectiveIndex}>
                  <div className="pk-objective-head">
                    <b>Sasaran {objectiveIndex + 1}</b>
                    {form.objectives.length > 1 && <button onClick={() => setForm({ ...form, objectives: form.objectives.filter((_:any, n:number) => n !== objectiveIndex) })}>Hapus Sasaran</button>}
                  </div>
                  <label>Jenis Sasaran
                    <select value={objective.objectiveType} onChange={(e) => setObjective(objectiveIndex, "objectiveType", e.target.value)}>
                      <option>Sasaran Program (Outcome)</option><option>Sasaran Kegiatan</option>
                    </select>
                  </label>
                  <label>Sasaran Program/Kegiatan
                    <input value={objective.objective} onChange={(e) => setObjective(objectiveIndex, "objective", e.target.value)} />
                  </label>
                  <div className="pk-indicator-editor-head"><b>Indikator Kinerja</b><button onClick={() => setObjective(objectiveIndex, "indicators", [...objective.indicators, blankIndicator()])}>+ Indikator</button></div>
                  {objective.indicators.map((i:any, indicatorIndex:number) => <div className="pk-indicator-editor" key={indicatorIndex}>
                    <label>Ambil dari RKT
                      <select value={i.sourceRktId || ""} onChange={(e) => fillFromRkt(objectiveIndex, indicatorIndex, e.target.value)}>
                        <option value="">Tambah manual</option>
                        {data.rkt.map((r:any) => <option value={r.id} key={r.id}>{r.year} · {r.programActivity || r.objective}</option>)}
                      </select>
                    </label>
                    {i.sourceRktId && (["objective", "indicator", "target"] as string[]).map((field) => <label key={field}>Sumber {field === "objective" ? "Sasaran" : field === "indicator" ? "Indikator" : "Target"}
                      <select value={i.sourceMapping?.[field] || (field === "objective" ? "programActivity" : field)} onChange={(e) => fillFromRkt(objectiveIndex, indicatorIndex, i.sourceRktId, { ...(i.sourceMapping || {}), [field]: e.target.value })}>
                        <option value="programActivity">Program/Kegiatan</option><option value="strategicObjective">Sasaran Strategis</option><option value="indicator">Indikator</option><option value="target">Target</option>
                      </select>
                    </label>)}
                    <label>Indikator
                      <input value={i.indicator} onChange={(e) => setNestedIndicator(objectiveIndex, indicatorIndex, "indicator", e.target.value)} />
                    </label>
                    <label>Target
                      <input value={i.target} onChange={(e) => setNestedIndicator(objectiveIndex, indicatorIndex, "target", e.target.value)} />
                    </label>
                    <label>Satuan
                      <input value={i.unit} onChange={(e) => setNestedIndicator(objectiveIndex, indicatorIndex, "unit", e.target.value)} />
                    </label>
                    <label>Tampilan Target
                      <input value={i.targetDisplay || ""} placeholder="Contoh: 100% atau BB" onChange={(e) => setNestedIndicator(objectiveIndex, indicatorIndex, "targetDisplay", e.target.value)} />
                    </label>
                    {objective.indicators.length > 1 && <button onClick={() => setObjective(objectiveIndex, "indicators", objective.indicators.filter((_:any, n:number) => n !== indicatorIndex))}>Hapus Indikator</button>}
                  </div>)}
                </section>)}
              </div>
              <div className="pk-budget-editor">
                <div><b>{form.agreementLevel === "Staf" ? "Alokasi Anggaran per Output" : "Anggaran per Program"}</b><button onClick={() => setForm({ ...form, budgets: [...(form.budgets || []), blankBudget()] })}>+ Anggaran</button></div>
                <datalist id="pk-program-options">{[...new Set(data.rkt.map((r:any) => r.programActivity || r.objective))].map((name:any) => <option value={name} key={name} />)}</datalist>
                {(form.budgets || []).map((budget:any, index:number) => <section key={index}>
                  <label>Program/Kegiatan<input list="pk-program-options" value={budget.programName} onChange={(e) => setForm({ ...form, budgets: form.budgets.map((b:any,n:number) => n === index ? { ...b, programName: e.target.value } : b) })} /></label>
                  {form.agreementLevel === "Staf" && <label>Output/Pekerjaan Staf<input value={budget.outputDescription || ""} onChange={(e) => setForm({ ...form, budgets: form.budgets.map((b:any,n:number) => n === index ? { ...b, outputDescription: e.target.value } : b) })} /></label>}
                  <label>{form.agreementLevel === "Staf" ? "Alokasi Anggaran" : "Anggaran"}<input type="number" min="0" value={budget.amount} onChange={(e) => setForm({ ...form, budgets: form.budgets.map((b:any,n:number) => n === index ? { ...b, amount: e.target.value } : b) })} /></label>
                  <strong>{rupiah(Number(budget.amount) || 0)}</strong>
                  {form.budgets.length > 1 && <button onClick={() => setForm({ ...form, budgets: form.budgets.filter((_:any,n:number) => n !== index) })}>Hapus</button>}
                </section>)}
                <footer><span>{form.agreementLevel === "Staf" ? "Total Alokasi Anggaran PK Staf" : "Total Anggaran"}</span><b>{rupiah((form.budgets || []).reduce((sum:number,b:any) => sum + (Number(b.amount) || 0), 0))}</b></footer>
                {form.agreementLevel === "Staf" && <p>Nominal merupakan bagian anggaran untuk output staf dan memerlukan konfirmasi atasan langsung. Nilai Rp0 diperbolehkan.</p>}
              </div>
              <label>
                Catatan
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </label>
            </div>
            <div className="modal-actions">
              <button onClick={() => { setShowPk(false); setEditing(null); setInheritedInfo(null); }}>Batal</button>
              <button
                className="primary"
                onClick={() => editing?.type === "edit-pk"
                  ? request("/api/performance-agreements", { ...form, id: editing.id, action: "update" }, "PATCH")
                  : request("/api/performance-agreements", form)}
                disabled={saving}
              >
                {editing?.type === "edit-pk" ? "Simpan Perubahan" : "Simpan Draft"}
              </button>
            </div>
          </div>
        </div>
      )}
      {showRkt && (
        <div className="modal-backdrop">
          <div className="modal pk-modal">
            <span>RENCANA KERJA TAHUNAN</span>
            <h3>{rktForm.documentKey ? "Edit RKT" : "Tambah RKT"}</h3>
            <div className="module-form">
              <label>
                Jenis RKT
                <select
                  value={rktForm.rktType}
                  onChange={(e) => {
                    const nextType = e.target.value;
                    setSelectedKetuaProgram("");
                    setRktForm({
                      ...rktForm,
                      rktType: nextType,
                      policyOwnerId: nextType === "Sekretaris"
                        ? plans.employees.find((emp: any) => emp.position === "Sekretaris")?.id || rktForm.policyOwnerId
                        : plans.employees.find((emp: any) => emp.position === "Ketua")?.id || rktForm.policyOwnerId,
                      programs: [blankRktProgram()],
                    });
                  }}
                >
                  <option>Ketua</option><option>Sekretaris</option>
                </select>
              </label>
              <label>
                Tahun
                <input
                  type="number"
                  value={rktForm.year}
                  onChange={(e) =>
                    setRktForm({ ...rktForm, year: e.target.value })
                  }
                />
              </label>
              <label>
                Penanggung jawab kebijakan
                <select
                  value={rktForm.policyOwnerId}
                  onChange={(e) =>
                    setRktForm({ ...rktForm, policyOwnerId: e.target.value })
                  }
                >
                  {plans.employees.map((e: any) => (
                    <option value={e.id} key={e.id}>
                      {e.fullName} · {e.position}
                    </option>
                  ))}
                </select>
              </label>
              {!rktForm.documentKey && rktForm.rktType === "Sekretaris" && (
                <label>
                  Program dari RKT Ketua (Opsional)
                  <select
                    value={selectedKetuaProgram}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedKetuaProgram(val);
                      const ketuaPrograms = (plans.documents || [])
                        .filter((d: any) => d.rktType === "Ketua" || d.scope === "Instansi")
                        .flatMap((d: any) =>
                          (d.programs || []).map((p: any, idx: number) => ({
                            key: `${d.documentKey || d.year}-${idx}-${p.programActivity}`,
                            docYear: d.year,
                            ...p,
                          }))
                        );
                      const found = ketuaPrograms.find((p: any) => p.key === val);
                      if (found) {
                        setRktForm((prev: any) => ({
                          ...prev,
                          programs: clonePrograms([found]),
                        }));
                      } else {
                        setRktForm((prev: any) => ({
                          ...prev,
                          programs: prev.programs?.length ? prev.programs : [blankRktProgram()],
                        }));
                      }
                    }}
                  >
                    <option value="">-- Buat Program Sendiri (Manual) --</option>
                    {(plans.documents || [])
                      .filter((d: any) => d.rktType === "Ketua" || d.scope === "Instansi")
                      .flatMap((d: any) =>
                        (d.programs || []).map((p: any, idx: number) => ({
                          key: `${d.documentKey || d.year}-${idx}-${p.programActivity}`,
                          docYear: d.year,
                          ...p,
                        }))
                      )
                      .map((p: any) => (
                        <option key={p.key} value={p.key}>
                          {p.docYear ? `[${p.docYear}] ` : ""}{p.programActivity} ({p.objectives?.length || 0} Sasaran)
                        </option>
                      ))}
                  </select>
                </label>
              )}
              {(() => {
                const isSekretarisFromKetua = !rktForm.documentKey && rktForm.rktType === "Sekretaris" && Boolean(selectedKetuaProgram);
                return (
                  <div className="rkt-builder">
                    <div className="rkt-builder-title">
                      <b>Struktur RKT {rktForm.rktType} {isSekretarisFromKetua ? "(Hanya Lihat - Mengikuti RKT Ketua)" : ""}</b>
                      {!isSekretarisFromKetua && (
                        <button onClick={() => setRktForm({ ...rktForm, programs: [...(rktForm.programs || []), blankRktProgram()] })}>+ Program/Kegiatan</button>
                      )}
                    </div>
                    {rktForm.programs.map((program:any, programIndex:number) => <article key={programIndex}>
                      <div className="pk-objective-head">
                        <b>Program/Kegiatan {programIndex + 1}</b>
                        {!isSekretarisFromKetua && rktForm.programs.length > 1 && (
                          <button onClick={() => setRktForm({ ...rktForm, programs: rktForm.programs.filter((_:any,n:number) => n !== programIndex) })}>Hapus Program</button>
                        )}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: "10px", alignItems: "start" }}>
                        <label>Program/Kegiatan
                          <input
                            value={program.programActivity}
                            readOnly={isSekretarisFromKetua}
                            style={isSekretarisFromKetua ? { background: "#f8fafc", cursor: "not-allowed" } : undefined}
                            onChange={(e) => !isSekretarisFromKetua && setRktForm({ ...rktForm, programs: rktForm.programs.map((p:any,n:number) => n === programIndex ? { ...p, programActivity: e.target.value } : p) })}
                          />
                        </label>
                        <label>Pagu Anggaran Program (Rp)
                          <input
                            type="number"
                            min={0}
                            value={program.budgetAmount ?? 0}
                            readOnly={isSekretarisFromKetua}
                            style={isSekretarisFromKetua ? { background: "#f8fafc", cursor: "not-allowed" } : undefined}
                            onChange={(e) => !isSekretarisFromKetua && setRktForm({ ...rktForm, programs: rktForm.programs.map((p:any,n:number) => n === programIndex ? { ...p, budgetAmount: Math.max(0, Number(e.target.value) || 0) } : p) })}
                          />
                          <span style={{ fontSize: "10px", color: "#047857", fontWeight: 600, display: "block", marginTop: "2px" }}>
                            {rupiah(Number(program.budgetAmount) || 0)}
                          </span>
                        </label>
                      </div>
                      <div className="pk-indicator-editor-head">
                        <b>{rktForm.rktType === "Ketua" ? "Sasaran Strategis" : "Sasaran Program (Outcome) / Sasaran Kegiatan"}</b>
                        {!isSekretarisFromKetua && (
                          <button onClick={() => setRktForm({ ...rktForm, programs: rktForm.programs.map((p:any,n:number) => n === programIndex ? { ...p, objectives: [...p.objectives, blankRktObjective()] } : p) })}>+ Sasaran</button>
                        )}
                      </div>
                      {program.objectives.map((objective:any, objectiveIndex:number) => <section key={objectiveIndex}>
                        <div className="pk-objective-head">
                          <strong>Sasaran {programIndex + 1}.{objectiveIndex + 1}</strong>
                          {!isSekretarisFromKetua && program.objectives.length > 1 && (
                            <button onClick={() => setRktForm({ ...rktForm, programs: rktForm.programs.map((p:any,n:number) => n === programIndex ? { ...p, objectives: p.objectives.filter((_:any,k:number) => k !== objectiveIndex) } : p) })}>Hapus Sasaran</button>
                          )}
                        </div>
                        <label>{rktForm.rktType === "Ketua" ? "Sasaran Strategis" : "Sasaran Program (Outcome) / Sasaran Kegiatan"}
                          <textarea
                            rows={2}
                            value={objective.objective}
                            readOnly={isSekretarisFromKetua}
                            style={isSekretarisFromKetua ? { background: "#f8fafc", cursor: "not-allowed" } : undefined}
                            onChange={(e) => !isSekretarisFromKetua && setRktForm({ ...rktForm, programs: rktForm.programs.map((p:any,n:number) => n === programIndex ? { ...p, objectives: p.objectives.map((o:any,k:number) => k === objectiveIndex ? { ...o, objective: e.target.value } : o) } : p) })}
                          />
                        </label>
                        <div className="pk-indicator-editor-head">
                          <b>Indikator</b>
                          {!isSekretarisFromKetua && (
                            <button onClick={() => setRktForm({ ...rktForm, programs: rktForm.programs.map((p:any,n:number) => n === programIndex ? { ...p, objectives: p.objectives.map((o:any,k:number) => k === objectiveIndex ? { ...o, indicators: [...o.indicators, blankRktIndicator()] } : o) } : p) })}>+ Indikator</button>
                          )}
                        </div>
                        {objective.indicators.map((indicator:any, indicatorIndex:number) => <div className="rkt-indicator-row" key={indicatorIndex}>
                          <label>Indikator
                            <input
                              value={indicator.indicator}
                              readOnly={isSekretarisFromKetua}
                              style={isSekretarisFromKetua ? { background: "#f8fafc", cursor: "not-allowed" } : undefined}
                              onChange={(e) => !isSekretarisFromKetua && setRktForm({ ...rktForm, programs: rktForm.programs.map((p:any,n:number) => n === programIndex ? { ...p, objectives: p.objectives.map((o:any,k:number) => k === objectiveIndex ? { ...o, indicators: o.indicators.map((i:any,q:number) => q === indicatorIndex ? { ...i, indicator: e.target.value } : i) } : o) } : p) })}
                            />
                          </label>
                          <label>Target
                            <input
                              value={indicator.target}
                              readOnly={isSekretarisFromKetua}
                              style={isSekretarisFromKetua ? { background: "#f8fafc", cursor: "not-allowed" } : undefined}
                              onChange={(e) => !isSekretarisFromKetua && setRktForm({ ...rktForm, programs: rktForm.programs.map((p:any,n:number) => n === programIndex ? { ...p, objectives: p.objectives.map((o:any,k:number) => k === objectiveIndex ? { ...o, indicators: o.indicators.map((i:any,q:number) => q === indicatorIndex ? { ...i, target: e.target.value } : i) } : o) } : p) })}
                            />
                          </label>
                          <label>Satuan
                            <input
                              value={indicator.unit}
                              readOnly={isSekretarisFromKetua}
                              style={isSekretarisFromKetua ? { background: "#f8fafc", cursor: "not-allowed" } : undefined}
                              onChange={(e) => !isSekretarisFromKetua && setRktForm({ ...rktForm, programs: rktForm.programs.map((p:any,n:number) => n === programIndex ? { ...p, objectives: p.objectives.map((o:any,k:number) => k === objectiveIndex ? { ...o, indicators: o.indicators.map((i:any,q:number) => q === indicatorIndex ? { ...i, unit: e.target.value } : i) } : o) } : p) })}
                            />
                          </label>
                          {!isSekretarisFromKetua && objective.indicators.length > 1 && (
                            <button onClick={() => setRktForm({ ...rktForm, programs: rktForm.programs.map((p:any,n:number) => n === programIndex ? { ...p, objectives: p.objectives.map((o:any,k:number) => k === objectiveIndex ? { ...o, indicators: o.indicators.filter((_:any,q:number) => q !== indicatorIndex) } : o) } : p) })}>Hapus</button>
                          )}
                        </div>)}
                      </section>)}
                    </article>)}
                  </div>
                );
              })()}
            </div>
            <div className="modal-actions">
              <button onClick={() => { setShowRkt(false); setSelectedKetuaProgram(""); setRktForm({ year, rktType: "Ketua", programs: [blankRktProgram()], policyOwnerId: "", notes: "", status: "Aktif", documentKey: undefined }); }}>Batal</button>
              <button
                className="primary"
                onClick={() => rktForm.documentKey
                  ? request("/api/work-plans", rktForm, "PATCH")
                  : request("/api/work-plans", rktForm)}
              >
                {rktForm.documentKey ? "Simpan Perubahan" : "Simpan RKT"}
              </button>
            </div>
          </div>
        </div>
      )}
      {showAction && (
        <div className="modal-backdrop">
          <div className="modal">
            <span>RENCANA AKSI</span>
            <h3>{actionForm.id ? "Edit Rencana Aksi" : "Turunkan RKT"}</h3>
            <div className="module-form">
              {(() => {
                const currentDoc = plans.documents?.find((r: any) =>
                  r.rows.some((row: any) => String(row.id) === String(actionForm.rktId))
                ) || plans.documents?.[0];

                const allObjectives = currentDoc?.programs?.flatMap((p: any) => p.objectives) || [];
                const currentObj = allObjectives.find((o: any) =>
                  o.indicators.some((ind: any) => String(ind.id) === String(actionForm.rktId))
                ) || allObjectives[0];

                const availableIndicators = currentObj?.indicators || [];

                return (
                  <>
                    <label>
                      Sasaran Terkait
                      <select
                        value={currentObj ? String(currentObj.indicators[0]?.id) : ""}
                        onChange={(e) => {
                          const chosenObj = allObjectives.find((o: any) =>
                            String(o.indicators[0]?.id) === e.target.value
                          );
                          if (chosenObj && chosenObj.indicators[0]) {
                            setActionForm((prev: any) => ({
                              ...prev,
                              rktId: chosenObj.indicators[0].id,
                            }));
                          }
                        }}
                      >
                        {allObjectives.map((o: any, oIdx: number) => (
                          <option key={oIdx} value={o.indicators[0]?.id}>
                            {o.objective}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Indikator Kinerja Terkait
                      <select
                        value={String(actionForm.rktId || "")}
                        onChange={(e) =>
                          setActionForm((prev: any) => ({
                            ...prev,
                            rktId: e.target.value,
                          }))
                        }
                      >
                        {availableIndicators.map((ind: any) => (
                          <option key={ind.id} value={ind.id}>
                            {ind.indicator} (Target: {ind.target} {ind.unit})
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                );
              })()}
              <label>
                Gunakan Referensi (Opsional)
                <select onChange={(e) => {
                  if (!e.target.value) return;
                  const allRefActions = plans.documents?.flatMap((d: any) =>
                    (d.actions || []).map((a: any) => ({
                      ...a,
                      docLabel: `RKT ${d.rktType || (d.scope === "Kesekretariatan" ? "Sekretaris" : "Ketua")}`
                    }))
                  ) || [];
                  const ref = allRefActions.find((a: any) => String(a.id) === e.target.value);
                  if (ref) {
                    setActionForm((prev: any) => ({
                      ...prev,
                      title: ref.title,
                      description: ref.description || "",
                      deadline: ref.deadline || ""
                    }));
                  }
                  e.target.value = "";
                }}>
                  <option value="">-- Pilih Rencana Aksi Sebelumnya --</option>
                  {Array.from(new Map((plans.documents?.flatMap((d: any) =>
                    (d.actions || []).map((a: any) => ({
                      ...a,
                      docLabel: `RKT ${d.rktType || (d.scope === "Kesekretariatan" ? "Sekretaris" : "Ketua")}`
                    }))
                  ) || []).map((a: any) => [`${a.docLabel} - ${a.title}`, a])).values()).map((a: any) => (
                    <option key={a.id} value={a.id}>{a.docLabel} - {a.title} {a.deadline ? `(${a.deadline})` : ""}</option>
                  ))}
                </select>
              </label>
              <label>
                Uraian Rencana Aksi
                <input
                  value={actionForm.title}
                  onChange={(e) =>
                    setActionForm({ ...actionForm, title: e.target.value })
                  }
                />
              </label>
              <label>
                Deskripsi
                <textarea
                  rows={2}
                  value={actionForm.description}
                  onChange={(e) =>
                    setActionForm({
                      ...actionForm,
                      description: e.target.value,
                    })
                  }
                />
              </label>
              <label>
                Unit Penanggung Jawab
                <input
                  value={actionForm.responsibleUnit}
                  onChange={(e) =>
                    setActionForm({
                      ...actionForm,
                      responsibleUnit: e.target.value,
                    })
                  }
                />
              </label>
              <label>
                Staf/PIC
                <select
                  value={actionForm.picEmployeeId}
                  onChange={(e) =>
                    setActionForm({
                      ...actionForm,
                      picEmployeeId: e.target.value,
                    })
                  }
                >
                  <option value="">Belum ditentukan</option>
                  {plans.employees.map((e: any) => (
                    <option value={e.id} key={e.id}>
                      {e.fullName} · {e.unit}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Deadline
                <input
                  type="date"
                  value={actionForm.deadline}
                  onChange={(e) =>
                    setActionForm({ ...actionForm, deadline: e.target.value })
                  }
                />
              </label>
            </div>
            <div className="modal-actions">
              <button onClick={() => { setShowAction(false); setActionForm(blankActionForm()); }}>Batal</button>
              <button
                className="primary"
                onClick={() =>
                  request("/api/work-plans", { ...actionForm, kind: "action" })
                }
              >
                Simpan Rencana Aksi
              </button>
            </div>
          </div>
        </div>
      )}
      {viewingActions && (
        <div className="modal-backdrop">
          <div className="modal pk-modal">
            <span>DAFTAR RENCANA AKSI</span>
            <h3>RKT {viewingActions.rktType} · {viewingActions.year}</h3>
            <div className="rkt-list" style={{ maxHeight: "60vh", overflowY: "auto", paddingRight: "0.5rem" }}>
              {viewingActions.actions.map((a: any) => (
                <article key={a.id} style={{ marginBottom: "1rem", padding: "1rem", border: "1px solid #eee", borderRadius: "8px" }}>
                  <div className="pk-card-head" style={{ marginBottom: "0" }}>
                    <div>
                      <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1rem" }}>{a.title}</h3>
                      <p style={{ margin: "0 0 0.5rem 0", color: "#555" }}>{a.description}</p>
                      <p style={{ margin: 0, fontSize: "0.85rem", color: "#777" }}>
                        PIC: {plans.employees.find((e:any) => e.id === a.picEmployeeId)?.fullName || "Belum ditentukan"} · Unit: {a.responsibleUnit} · Deadline: {a.deadline || "Belum ditentukan"}
                      </p>
                    </div>
                  </div>
                  {plans.canManage && <div className="row-actions" style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid #eee" }}>
                    <button onClick={() => { setActionForm({ ...a, rktId: viewingActions.rows[0]?.id || "" }); setShowAction(true); setViewingActions(null); }}>Edit</button>
                    <button className="danger" onClick={() => { if (confirm("Yakin ingin menghapus rencana aksi ini?")) { request(`/api/work-plans?actionId=${a.id}`, {}, "DELETE"); setViewingActions(null); } }}>Hapus</button>
                  </div>}
                </article>
              ))}
              {!viewingActions.actions.length && <p>Belum ada rencana aksi.</p>}
            </div>
            <div className="modal-actions">
              <button onClick={() => setViewingActions(null)}>Tutup</button>
              {plans.canManage && <button className="primary" onClick={() => {
                const defaultPicId = viewingActions.policyOwnerId || (viewingActions.rktType === "Sekretaris" ? plans.employees?.find((e: any) => e.position === "Sekretaris")?.id : plans.employees?.find((e: any) => e.position === "Ketua")?.id) || "";
                setActionForm(blankActionForm(viewingActions.rows[0]?.id || "", defaultPicId));
                setShowAction(true);
                setViewingActions(null);
              }}>+ Rencana Aksi</button>}
            </div>
          </div>
        </div>
      )}
      {editing?.type === "monev" && (
        <div className="modal-backdrop">
          <div className="modal pk-modal">
            <span>MONITORING DAN EVALUASI</span>
            <h3>{editing.indicator.indicator}</h3>
            <div className="module-form">
              <div className="pk-form-grid">
                <label>Jenis Periode<select value={editing.form.periodType} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, periodType: e.target.value, periodKey: "" } })}><option>Bulanan</option><option>Triwulanan</option><option>Tahunan</option></select></label>
                <label>Periode yang Dievaluasi<select value={editing.form.periodKey} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, periodKey: e.target.value } })}><option value="">Pilih periode</option>{editing.form.periodType === "Bulanan" && monthlyPeriods.map((month) => <option value={`${editing.agreement.year}-${String(month).padStart(2, "0")}`} key={month}>{monthNames[month - 1]} {editing.agreement.year}</option>)}{editing.form.periodType === "Triwulanan" && [1,2,3].map((q) => <option value={`${editing.agreement.year}-Q${q}`} key={q}>Triwulan {q} · {editing.agreement.year}</option>)}{editing.form.periodType === "Tahunan" && <option value={String(editing.agreement.year)}>Tahun Kinerja {editing.agreement.year}</option>}</select></label>
                <label>Progress (%)<input type="number" min="0" max="100" value={editing.form.progress} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, progress: e.target.value } })} /></label>
                <label>Realisasi Anggaran{editing.agreement.budgetTotal > 0 ? <input type="number" min="0" value={editing.form.budgetRealization} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, budgetRealization: e.target.value } })} /> : <input value="Tidak ada anggaran" disabled />}</label>
              </div>
              <div className="monev-schedule-note"><b>Waktu pengisian: {periodDetails(editing.form.periodType, editing.form.periodKey).submitted}</b><span>Monev hanya memuat kegiatan yang telah selesai pada periode yang dievaluasi. Triwulanan dan tahunan merupakan rekap kumulatif.</span></div>
              {(() => {
                const previous = previousMonev(editing.agreement, editing.indicator.id, editing.form);
                if (!previous) return <div className="monev-previous empty"><b>Ringkasan Monev Periode Sebelumnya</b><p>Belum ada data Monev periode sebelumnya untuk jenis periode ini.</p></div>;
                const progressDelta = Number(editing.form.progress || 0) - Number(previous.progress || 0);
                const budgetDelta = Number(editing.form.budgetRealization || 0) - Number(previous.budgetRealization || 0);
                return <div className="monev-previous">
                  <header><div><span>RINGKASAN PERIODE SEBELUMNYA</span><b>{previous.periodType} · {periodDetails(previous.periodType, previous.periodKey).evaluated}</b></div>{!editing.form.id && <button type="button" onClick={() => setEditing({ ...editing, form: { ...editing.form, problemIdentification: previous.problemIdentification || "", improvementEffort: previous.improvementEffort || "", notes: previous.notes || "" } })}>Salin sebagai Data Awal</button>}</header>
                  <div className="monev-previous-stats"><div><span>Progress sebelumnya</span><b>{previous.progress}%</b></div><div><span>Progress sekarang</span><b>{editing.form.progress || 0}%</b><small className={progressDelta < 0 ? "negative" : ""}>{progressDelta >= 0 ? "+" : ""}{progressDelta}%</small></div><div><span>Anggaran sebelumnya</span><b>{rupiah(previous.budgetRealization)}</b></div><div><span>Anggaran sekarang</span><b>{rupiah(Number(editing.form.budgetRealization || 0))}</b><small className={budgetDelta < 0 ? "negative" : ""}>{budgetDelta >= 0 ? "+" : ""}{rupiah(budgetDelta)}</small></div></div>
                  <div className="monev-previous-copy"><p><b>Realisasi Output:</b> {previous.outputRealization || "—"}</p><p><b>Permasalahan:</b> {previous.problemIdentification || "—"}</p><p><b>Upaya Peningkatan:</b> {previous.improvementEffort || "—"}</p><p><b>Kegiatan:</b> {previous.completedActivities || "—"}</p><p><b>Keterangan:</b> {previous.notes || "—"}</p>{!!previous.evidenceLinks?.length && <div className="monev-links">{previous.evidenceLinks.map((link:string,n:number) => <a href={link} target="_blank" rel="noreferrer" key={n}>Bukti {n + 1}</a>)}</div>}</div>
                </div>;
              })()}
              <label>Realisasi Output<textarea rows={3} value={editing.form.outputRealization} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, outputRealization: e.target.value } })} /></label>
              <label>Identifikasi Permasalahan<textarea rows={3} value={editing.form.problemIdentification} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, problemIdentification: e.target.value } })} /></label>
              <label>Upaya Peningkatan<textarea rows={3} value={editing.form.improvementEffort} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, improvementEffort: e.target.value } })} /></label>
              <label>Kegiatan yang Sudah Dilaksanakan<textarea rows={3} value={editing.form.completedActivities} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, completedActivities: e.target.value } })} /></label>
              <div className="monev-evidence"><div><b>Link Bukti Dukung</b><button onClick={() => setEditing({ ...editing, form: { ...editing.form, evidenceLinks: [...editing.form.evidenceLinks, ""] } })}>+ Link</button></div>{editing.form.evidenceLinks.map((link:string,n:number) => <div key={n}><input type="url" placeholder="https://..." value={link} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, evidenceLinks: editing.form.evidenceLinks.map((x:string,k:number) => k === n ? e.target.value : x) } })} />{editing.form.evidenceLinks.length > 1 && <button onClick={() => setEditing({ ...editing, form: { ...editing.form, evidenceLinks: editing.form.evidenceLinks.filter((_:string,k:number) => k !== n) } })}>Hapus</button>}</div>)}</div>
              <label>Keterangan<textarea rows={3} value={editing.form.notes} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, notes: e.target.value } })} /></label>
            </div>
            <div className="modal-actions">
              <button onClick={() => setEditing(null)}>Batal</button>
              <button
                className="primary"
                onClick={() => request("/api/performance-evaluations", { ...editing.form, indicatorId: editing.indicator.id }, editing.form.id ? "PATCH" : "POST")}
              >
                {editing.form.id ? "Simpan Perubahan" : "Simpan Monev"}
              </button>
            </div>
          </div>
        </div>
      )}
      {editing?.type === "print-monev" && <article className="monev-print-sheet">
        <h1>REKAP MONITORING DAN EVALUASI KINERJA</h1><p>Tahun {monevYearFilter} · {monevTypeFilter} · Unit {monevUnitFilter}</p>
        <table><thead><tr><th>No.</th><th>Pegawai/Unit</th><th>Indikator</th><th>Periode</th><th>Progress</th><th>Realisasi Anggaran</th><th>Realisasi Output</th><th>Permasalahan</th><th>Upaya Peningkatan</th><th>Kegiatan</th><th>Bukti</th><th>Keterangan</th></tr></thead>
        <tbody>{editing.rows.map((row:any,n:number) => <tr key={row.e.id}><td>{n + 1}</td><td>{row.a.employee?.fullName}<br />{row.a.employee?.unitSubsection}</td><td>{row.indicator?.indicator}</td><td>{row.e.periodType}<br />Evaluasi: {periodDetails(row.e.periodType, row.e.periodKey).evaluated}<br />Pengisian: {periodDetails(row.e.periodType, row.e.periodKey).submitted}</td><td>{row.e.progress}%</td><td>{rupiah(row.e.budgetRealization)}</td><td>{row.e.outputRealization || "—"}</td><td>{row.e.problemIdentification || "—"}</td><td>{row.e.improvementEffort || "—"}</td><td>{row.e.completedActivities || "—"}</td><td>{row.e.evidenceLinks.join("\n") || "—"}</td><td>{row.e.notes || "—"}</td></tr>)}</tbody></table>
      </article>}
      {editing && !editing.type && (
        <article className="pk-print-sheet">
          <h1>{editing.version > 1 ? `PERUBAHAN KE-${editing.version - 1} ` : ""}PERJANJIAN KINERJA</h1>
          <p>{String(editing.agreementLevel || editing.employee?.position || "").toUpperCase()} · TAHUN {editing.year}</p>
          <table>
            <thead>
              <tr>
                <th>No.</th>
                <th>Sasaran Program (Outcome) / Sasaran Kegiatan</th>
                <th>Indikator Kinerja</th>
                <th>Target</th>
              </tr>
            </thead>
            <tbody>
              {editing.objectives.flatMap((objective:any, n:number) => objective.indicators.map((i:any, k:number) => <tr key={i.id}>
                {k === 0 && <td rowSpan={objective.indicators.length}>{n + 1}</td>}
                {k === 0 && <td rowSpan={objective.indicators.length}>{objective.objective}</td>}
                <td>{i.indicator}</td>
                <td>{i.targetDisplay || `${i.target} ${i.unit}`}</td>
              </tr>))}
            </tbody>
          </table>
          <table className="pk-budget-print">
            <thead><tr><th>{editing.agreementLevel === "Staf" ? "Program / Kegiatan dan Output Staf" : "Program"}</th><th>{editing.agreementLevel === "Staf" ? "Alokasi Anggaran" : "Anggaran"}</th></tr></thead>
            <tbody>
              {editing.budgets.map((budget:any, n:number) => <tr key={budget.id}><td>{n + 1}. {budget.programName}{budget.outputDescription ? ` — ${budget.outputDescription}` : ""}</td><td>{rupiah(budget.amount)}</td></tr>)}
              <tr><th>{editing.agreementLevel === "Staf" ? "Total Alokasi Anggaran" : "Total Anggaran"}</th><th>{rupiah(editing.budgetTotal)}</th></tr>
            </tbody>
          </table>
          <footer className={String(editing.employee?.position || editing.agreementLevel || "").trim().toLowerCase() === "ketua" || (String(editing.employee?.position || editing.agreementLevel || "").trim().toLowerCase() === "sekretaris" && String(editing.supervisor?.position || "").trim().toLowerCase() !== "ketua") ? "single" : ""}>
            <div>
              <p>Pegawai yang berjanji,</p>
              <b>{editing.employee?.fullName}</b>
            </div>
            {String(editing.employee?.position || editing.agreementLevel || "").trim().toLowerCase() !== "ketua" && !(String(editing.employee?.position || editing.agreementLevel || "").trim().toLowerCase() === "sekretaris" && String(editing.supervisor?.position || "").trim().toLowerCase() !== "ketua") && <div>
              <p>Atasan langsung,</p>
              <b>{editing.supervisor?.fullName || "Belum ditentukan"}</b>
            </div>}
          </footer>
        </article>
      )}
      {toast && (
        <div className="toast">
          <span>✓</span>
          {toast}
        </div>
      )}
    </section>
  );
}
