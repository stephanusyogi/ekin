"use client";
import { useEffect, useMemo, useState } from "react";
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
const blankRktProgram = () => ({ programActivity: "", objectives: [blankRktObjective()] });
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
    [saving, setSaving] = useState(false),
    [toast, setToast] = useState(""),
    [filter, setFilter] = useState("Semua"),
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
    [actionForm, setActionForm] = useState<any>({
      rktId: "",
      title: "",
      description: "",
      responsibleUnit: "",
      picEmployeeId: "",
      deadline: "",
    }),
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
      setEditing(null);
      await load();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Data belum tersimpan");
    } finally {
      setSaving(false);
    }
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
      (a: any) => filter === "Semua" || a.status === filter,
    ),
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
            <button onClick={() => { setRktForm({ year, rktType: "Ketua", programs: [blankRktProgram()], policyOwnerId: plans.employees.find((e:any) => e.position === "Ketua")?.id || "", notes: "", status: "Aktif" }); setShowRkt(true); }}>+ RKT</button>
          )}
          <button className="primary" onClick={() => setShowPk(true)}>
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
        <div className="rkt-list">
          {plans.documents?.length ? (
            plans.documents.map((r: any) => (
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
                  <b>{pn + 1}. {p.programActivity}</b>
                  {p.objectives.map((o:any, on:number) => <section key={on}><strong>{pn + 1}.{on + 1} {o.objective}</strong>
                    {o.indicators.map((i:any, ix:number) => <span key={i.id}>{pn + 1}.{on + 1}.{ix + 1} {i.indicator} · Target {i.target} {i.unit}</span>)}
                  </section>)}
                </div>)}</div>
                {plans.canManage && <div className="row-actions">
                  <button className="secondary-action" onClick={() => { setActionForm({ ...actionForm, rktId: r.rows[0]?.id || "" }); setShowAction(true); }}>+ Rencana Aksi</button>
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
              {data.canManageAll && (
                <label>
                  Pegawai
                  <select
                    value={form.employeeId}
                    onChange={(e) =>
                      setForm({ ...form, employeeId: e.target.value })
                    }
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
                  <select
                    value={form.sourceRktId}
                    onChange={(e) =>
                      setForm({ ...form, sourceRktId: e.target.value })
                    }
                  >
                    <option value="">Tidak terkait langsung</option>
                    {data.rkt.map((x: any) => (
                      <option value={x.id} key={x.id}>
                        {x.scope} · {x.objective}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Rencana Aksi terkait
                  <select
                    value={form.sourceActionPlanId}
                    onChange={(e) =>
                      setForm({ ...form, sourceActionPlanId: e.target.value })
                    }
                  >
                    <option value="">Tidak ada</option>
                    {data.actionPlans.map((x: any) => (
                      <option value={x.id} key={x.id}>
                        {x.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  PK induk/cascading
                  <select
                    value={form.parentAgreementId}
                    onChange={(e) =>
                      setForm({ ...form, parentAgreementId: e.target.value })
                    }
                  >
                    <option value="">PK mandiri</option>
                    {data.agreements.map((x: any) => (
                      <option value={x.id} key={x.id}>
                        #{x.id} {x.employee?.fullName} · {x.title}
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
              <button onClick={() => { setShowPk(false); setEditing(null); }}>Batal</button>
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
                  onChange={(e) => setRktForm({ ...rktForm, rktType: e.target.value })}
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
              <div className="rkt-builder">
                <div className="rkt-builder-title"><b>Struktur RKT {rktForm.rktType}</b><button onClick={() => setRktForm({ ...rktForm, programs: [...rktForm.programs, blankRktProgram()] })}>+ Program/Kegiatan</button></div>
                {rktForm.programs.map((program:any, programIndex:number) => <article key={programIndex}>
                  <div className="pk-objective-head"><b>Program/Kegiatan {programIndex + 1}</b>{rktForm.programs.length > 1 && <button onClick={() => setRktForm({ ...rktForm, programs: rktForm.programs.filter((_:any,n:number) => n !== programIndex) })}>Hapus Program</button>}</div>
                  <label>Program/Kegiatan<input value={program.programActivity} onChange={(e) => setRktForm({ ...rktForm, programs: rktForm.programs.map((p:any,n:number) => n === programIndex ? { ...p, programActivity: e.target.value } : p) })} /></label>
                  <div className="pk-indicator-editor-head"><b>{rktForm.rktType === "Ketua" ? "Sasaran Strategis" : "Sasaran Program (Outcome) / Sasaran Kegiatan"}</b><button onClick={() => setRktForm({ ...rktForm, programs: rktForm.programs.map((p:any,n:number) => n === programIndex ? { ...p, objectives: [...p.objectives, blankRktObjective()] } : p) })}>+ Sasaran</button></div>
                  {program.objectives.map((objective:any, objectiveIndex:number) => <section key={objectiveIndex}>
                    <div className="pk-objective-head"><strong>Sasaran {programIndex + 1}.{objectiveIndex + 1}</strong>{program.objectives.length > 1 && <button onClick={() => setRktForm({ ...rktForm, programs: rktForm.programs.map((p:any,n:number) => n === programIndex ? { ...p, objectives: p.objectives.filter((_:any,k:number) => k !== objectiveIndex) } : p) })}>Hapus Sasaran</button>}</div>
                    <label>{rktForm.rktType === "Ketua" ? "Sasaran Strategis" : "Sasaran Program (Outcome) / Sasaran Kegiatan"}<textarea rows={2} value={objective.objective} onChange={(e) => setRktForm({ ...rktForm, programs: rktForm.programs.map((p:any,n:number) => n === programIndex ? { ...p, objectives: p.objectives.map((o:any,k:number) => k === objectiveIndex ? { ...o, objective: e.target.value } : o) } : p) })} /></label>
                    <div className="pk-indicator-editor-head"><b>Indikator</b><button onClick={() => setRktForm({ ...rktForm, programs: rktForm.programs.map((p:any,n:number) => n === programIndex ? { ...p, objectives: p.objectives.map((o:any,k:number) => k === objectiveIndex ? { ...o, indicators: [...o.indicators, blankRktIndicator()] } : o) } : p) })}>+ Indikator</button></div>
                    {objective.indicators.map((indicator:any, indicatorIndex:number) => <div className="rkt-indicator-row" key={indicatorIndex}>
                      <label>Indikator<input value={indicator.indicator} onChange={(e) => setRktForm({ ...rktForm, programs: rktForm.programs.map((p:any,n:number) => n === programIndex ? { ...p, objectives: p.objectives.map((o:any,k:number) => k === objectiveIndex ? { ...o, indicators: o.indicators.map((i:any,q:number) => q === indicatorIndex ? { ...i, indicator: e.target.value } : i) } : o) } : p) })} /></label>
                      <label>Target<input value={indicator.target} onChange={(e) => setRktForm({ ...rktForm, programs: rktForm.programs.map((p:any,n:number) => n === programIndex ? { ...p, objectives: p.objectives.map((o:any,k:number) => k === objectiveIndex ? { ...o, indicators: o.indicators.map((i:any,q:number) => q === indicatorIndex ? { ...i, target: e.target.value } : i) } : o) } : p) })} /></label>
                      <label>Satuan<input value={indicator.unit} onChange={(e) => setRktForm({ ...rktForm, programs: rktForm.programs.map((p:any,n:number) => n === programIndex ? { ...p, objectives: p.objectives.map((o:any,k:number) => k === objectiveIndex ? { ...o, indicators: o.indicators.map((i:any,q:number) => q === indicatorIndex ? { ...i, unit: e.target.value } : i) } : o) } : p) })} /></label>
                      {objective.indicators.length > 1 && <button onClick={() => setRktForm({ ...rktForm, programs: rktForm.programs.map((p:any,n:number) => n === programIndex ? { ...p, objectives: p.objectives.map((o:any,k:number) => k === objectiveIndex ? { ...o, indicators: o.indicators.filter((_:any,q:number) => q !== indicatorIndex) } : o) } : p) })}>Hapus</button>}
                    </div>)}
                  </section>)}
                </article>)}
              </div>
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowRkt(false)}>Batal</button>
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
            <h3>Turunkan RKT</h3>
            <div className="module-form">
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
              <button onClick={() => setShowAction(false)}>Batal</button>
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
