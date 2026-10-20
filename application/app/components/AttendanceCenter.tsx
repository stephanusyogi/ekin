"use client";
import { useEffect, useState } from "react";
import DailyActivityCalendar from "./DailyActivityCalendar";

type Today = {
  attendance: any;
  activeOther: any;
  reopen: any;
  schedule: any;
  day: any;
};
type Other = {
  id: number;
  type: "DL" | "Cuti";
  startDate: string;
  endDate: string;
  durationDays: number;
  documentNumber: string;
  documentDate: string;
  leaveType: string;
  destination: string;
  purpose: string;
  notes: string;
};
type TeamEmployee = {
  id: number;
  fullName: string;
  email: string;
  position: string;
  unit: string;
};
type TeamAttendance = {
  id: number;
  employeeEmail: string;
  workDate: string;
  checkIn: string;
  checkOut: string | null;
  attendanceStatus: string;
  lateMinutes: number;
  replacementMinutes: number;
  workOutput: string;
};
type TeamRecap = {
  period: { from: string; to: string };
  employees: TeamEmployee[];
  records: TeamAttendance[];
};

function formatAttendanceClock(raw?: string | null): string {
  if (!raw) return "—";
  const isoStr = raw.includes("T") ? raw : raw.replace(" ", "T");
  const withZone = isoStr.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(isoStr) ? isoStr : `${isoStr}Z`;
  const parsed = new Date(withZone);
  if (isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
    timeZone: "Asia/Jakarta",
  });
}

export interface ParsedWorkOutputItem {
  num?: string;
  time?: string;
  title: string;
  output?: string;
  raw: string;
}

export function parseWorkOutputItems(text?: string | null): ParsedWorkOutputItem[] {
  if (!text || !text.trim()) return [];

  const rawParts = text
    .split(/\r?\n|(?<=\S)\s+(?=\d+[\.\)])/)
    .map((s) => s.trim())
    .filter(Boolean);

  const pattern = /^(?:(\d+)[\.\)]\s*)?(?:\[([^\]]+)\]\s*)?(.*?)(?:\s*\((?:Output|output):\s*([^\)]+)\))?$/;

  return rawParts.map((part, index) => {
    const match = part.match(pattern);
    if (match) {
      const num = match[1] || (rawParts.length > 1 ? String(index + 1) : undefined);
      const time = match[2]?.trim();
      const title = match[3]?.trim() || part;
      const output = match[4]?.trim();
      return { num, time, title, output, raw: part };
    }
    return {
      num: rawParts.length > 1 ? String(index + 1) : undefined,
      title: part,
      raw: part,
    };
  });
}

export function VerticalWorkOutput({
  text,
  className = "",
}: {
  text?: string | null;
  className?: string;
}) {
  if (!text || !text.trim()) return <span className="empty-dash">—</span>;
  const items = parseWorkOutputItems(text);
  if (items.length === 0) return <span className="empty-dash">—</span>;

  if (items.length === 1 && !items[0].time && !items[0].output && !items[0].num) {
    return <span className={`table-work-output-single ${className}`}>{items[0].title}</span>;
  }

  return (
    <div className={`table-work-output-stack ${className}`}>
      {items.map((it, idx) => (
        <div key={idx} className="table-work-output-item">
          <div className="table-work-output-meta">
            {it.num && <span className="table-output-num">{it.num}.</span>}
            {it.time && <span className="table-output-time">[{it.time}]</span>}
          </div>
          <div className="table-output-content">
            <span className="table-output-title">{it.title}</span>
            {it.output && (
              <span className="table-output-tag">Output: {it.output}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AttendanceCenter() {
  const [today, setToday] = useState<Today | null>(null);
  const [records, setRecords] = useState<Other[]>([]);
  const [recap, setRecap] = useState<any>(null);
  const [teamRecap, setTeamRecap] = useState<TeamRecap | null>(null);
  const [pending, setPending] = useState<any[]>([]);
  const [role, setRole] = useState("user");
  const [tab, setTab] = useState<
    "hari-ini" | "aktivitas" | "dl" | "cuti" | "rekap" | "tim" | "pembukaan"
  >("hari-ini");
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [workOutput, setWorkOutput] = useState("");
  const [todayActivities, setTodayActivities] = useState<any[]>([]);
  const todayDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const openCheckout = async () => {
    try {
      const res = await fetch(`/api/attendance/activities?date=${todayDate}`);
      const data = await res.json();
      const acts = data.activities || [];
      setTodayActivities(acts);
      if (acts.length > 0) {
        const summary = acts
          .map(
            (a: any, i: number) =>
              `${i + 1}. [${a.startTime}–${a.endTime}] ${a.title}${
                a.output ? ` (Output: ${a.output})` : ""
              }`,
          )
          .join("\n");
        setWorkOutput(summary);
      } else if (!workOutput.trim() && today?.attendance?.workOutput) {
        setWorkOutput(today.attendance.workOutput);
      }
    } catch {
      // fallback
    }
    setShowCheckout(true);
  };
  const [dl, setDl] = useState({
    documentNumber: "",
    documentDate: todayDate,
    startDate: todayDate,
    endDate: todayDate,
    destination: "",
    purpose: "",
    notes: "",
  });
  const [leave, setLeave] = useState({
    leaveType: "Cuti Tahunan",
    documentNumber: "",
    documentDate: todayDate,
    startDate: todayDate,
    endDate: todayDate,
    notes: "",
  });
  const [reason, setReason] = useState("");
  const [reopenType, setReopenType] = useState("Absen Masuk");
  const [statement, setStatement] = useState<File | null>(null);
  const [statementInputKey, setStatementInputKey] = useState(0);
  const [showReopenForm, setShowReopenForm] = useState(false);
  const notify = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 2600);
  };
  const load = async () => {
    try {
      const results = await Promise.allSettled([
        fetch("/api/attendance"),
        fetch("/api/attendance/other"),
        fetch("/api/attendance/recap"),
        fetch("/api/attendance/team-recap"),
        fetch("/api/attendance/reopen?scope=team"),
        fetch("/api/me"),
      ]);
      const [a, o, r, t, p, m] = results;
      if (a.status === "fulfilled" && a.value.ok) setToday(await a.value.json());
      if (o.status === "fulfilled" && o.value.ok) setRecords((await o.value.json()).records || []);
      if (r.status === "fulfilled" && r.value.ok) setRecap(await r.value.json());
      if (t.status === "fulfilled" && t.value.ok) setTeamRecap(await t.value.json());
      if (p.status === "fulfilled" && p.value.ok) setPending((await p.value.json()).requests || []);
      if (m.status === "fulfilled" && m.value.ok) setRole((await m.value.json()).user?.role || "user");
    } catch {
      notify("Data absensi belum dapat dimuat");
    }
  };
  useEffect(() => {
    load();
  }, []);
  const addOther = async (type: "DL" | "Cuti") => {
    setSaving(true);
    try {
      const body = type === "DL" ? { type, ...dl } : { type, ...leave };
      const res = await fetch("/api/attendance/other", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      notify(`${type} berhasil dicatat · ${data.record.durationDays} hari`);
      await load();
      if (type === "DL")
        setDl({
          ...dl,
          documentNumber: "",
          destination: "",
          purpose: "",
          notes: "",
        });
      else setLeave({ ...leave, documentNumber: "", notes: "" });
    } catch (e) {
      notify(e instanceof Error ? e.message : "Data belum tersimpan");
    } finally {
      setSaving(false);
    }
  };
  const deleteOther = async (id: number, type: string) => {
    if (!confirm(`Hapus pencatatan ${type} ini?`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/attendance/other?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      notify(`${type} berhasil dihapus`);
      await load();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Data belum dapat dihapus");
    } finally {
      setSaving(false);
    }
  };
  const requestReopen = async () => {
    if (!reason.trim()) {
      notify("Alasan pembukaan wajib diisi");
      return;
    }
    if (!statement) {
      notify("Lampirkan surat pernyataan pribadi");
      return;
    }
    setSaving(true);
    try {
      const body=new FormData();
      body.set("reason",reason);
      body.set("attendanceType",reopenType);
      body.set("workDate",todayDate);
      body.set("statement",statement);
      const res = await fetch("/api/attendance/reopen", {
        method: "POST",
        body,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setReason("");
      setStatement(null);
      setStatementInputKey((value)=>value+1);
      setShowReopenForm(false);
      notify("Permintaan dikirim kepada pejabat yang berwenang");
      await load();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Permintaan belum terkirim");
    } finally {
      setSaving(false);
    }
  };
  const decide = async (id: number, decision: "Disetujui" | "Ditolak") => {
    setSaving(true);
    try {
      const res = await fetch("/api/attendance/reopen", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, decision }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      notify(`Permintaan ${decision.toLowerCase()}`);
      await load();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Keputusan belum tersimpan");
    } finally {
      setSaving(false);
    }
  };
  const checkIn = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/attendance", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "check_in" }),
        }),
        data = await res.json();
      if (!res.ok) throw new Error(data.error);
      notify(
        today?.day?.isHoliday
          ? "Absensi hari libur berhasil dicatat"
          : "Absen masuk berhasil dicatat",
      );
      await load();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Absen masuk belum tercatat");
    } finally {
      setSaving(false);
    }
  };
  const checkOut = async () => {
    if (!workOutput.trim()) {
      notify("Isi Output Pekerjaan terlebih dahulu");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/attendance", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "check_out", workOutput }),
        }),
        data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowCheckout(false);
      setWorkOutput("");
      notify("Absen pulang dan output pekerjaan berhasil dicatat");
      await load();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Absen pulang belum tercatat");
    } finally {
      setSaving(false);
    }
  };
  const status = today?.attendance?.attendanceStatus;
  const statusLabel =
    today?.activeOther?.type ||
    (
      {
        on_time: "Normal",
        late: "Terlambat",
        absent_late: "Tidak Masuk Kerja",
        holiday_recorded: "Tercatat pada Hari Libur",
      } as any
    )[status] ||
    "Belum Absen";
  const needsReopen=Boolean(today?.day?.isClosed||(!today?.attendance&&!today?.schedule?.canCheckIn)||(today?.attendance&&!today?.attendance?.checkOut&&!today?.schedule?.canCheckOut));
  return (
    <section className="attendance-page">
      <div className="page-title">
        <div>
          <p>MODUL INTI</p>
          <h1>Absensi Pegawai</h1>
          <span>
            Masuk, Pulang, Dinas Luar, Cuti, pembukaan akses, dan rekap 21–20.
          </span>
        </div>
      </div>
      <div className="attendance-tabs">
        {[
          ["hari-ini", "Hari Ini"],
          ["aktivitas", "Aktivitas Harian"],
          ["dl", "Dinas Luar"],
          ["cuti", "Cuti"],
          ["rekap", "Rekap Saya"],
          ...(teamRecap?.employees?.length ? [["tim", "Rekap Bawahan"]] : []),
          ...(["super_user","super_admin", "admin","editor"].includes(role)||pending.length||teamRecap?.employees?.length
            ? [["pembukaan", "Persetujuan Pembukaan"]]
            : []),
        ].map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id as any)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "aktivitas" && (
        <DailyActivityCalendar onActivityChanged={load} />
      )}
      {tab === "hari-ini" && (
        <div className="attendance-module-grid">
          <article className="module-card status-large">
            <span>AKTIVITAS ABSENSI HARI INI</span>
            <h2>{statusLabel}</h2>
            {today?.activeOther ? (
              <p>
                {today.activeOther.startDate}–{today.activeOther.endDate} ·{" "}
                {today.activeOther.durationDays} hari
              </p>
            ) : today?.attendance ? (
              <>
                <p>
                  Masuk {formatAttendanceClock(today.attendance.checkIn)} · Terlambat {today.attendance.lateMinutes} menit
                </p>
                <p>
                  Pengganti {today.attendance.replacementMinutes} menit setelah
                  jam pulang · Pulang{" "}
                  {today.attendance.checkOut
                    ? formatAttendanceClock(today.attendance.checkOut)
                    : "belum tercatat"}
                </p>
              </>
            ) : (
              <p>
                Jam kerja {today?.schedule?.start || "07:30"}–
                {today?.schedule?.end || "16:00"} · batas masuk{" "}
                {today?.schedule?.attendanceCutoff || "08:30"}
              </p>
            )}
            <div className="attendance-center-actions">
              <button
                className={
                  today?.attendance
                    ? "attendance-button success"
                    : "attendance-button"
                }
                onClick={checkIn}
                disabled={
                  saving ||
                  Boolean(today?.attendance) ||
                  Boolean(today?.activeOther) ||
                  !today?.schedule?.canCheckIn
                }
              >
                {today?.attendance
                  ? "✓ Sudah Absen Masuk"
                  : today?.schedule?.canCheckIn
                    ? "Absen Masuk"
                    : "Absen Masuk Terkunci"}
              </button>
              <button
                className={
                  today?.attendance?.checkOut
                    ? "attendance-button success"
                    : "attendance-button checkout"
                }
                onClick={() => openCheckout()}
                disabled={
                  saving ||
                  !today?.attendance ||
                  Boolean(today?.attendance?.checkOut) ||
                  Boolean(today?.activeOther) ||
                  !today?.schedule?.canCheckOut
                }
              >
                {today?.attendance?.checkOut
                  ? "✓ Sudah Absen Pulang"
                  : today?.schedule?.canCheckOut
                    ? "Absen Pulang"
                    : "Absen Pulang Terkunci"}
              </button>
            </div>
            <div className="status-pills">
              <i>Sen–Kam 07.30–16.00</i>
              <i>Jumat 07.30–16.30</i>
              <i>Penggantian 1:1</i>
            </div>
          </article>
          <article className="module-card">
            <span>PENUTUPAN HARIAN</span>
            <h3>
              {today?.schedule?.dailyCloseEnabled
                ? `Ditutup pukul ${today.schedule.dailyCloseTime}`
                : "Tidak diaktifkan"}
            </h3>
            <p>
              {needsReopen
                ? "Absensi sudah terkunci. Ajukan pembukaan untuk akses selama 1 jam."
                : today?.day?.reopened
                  ? "Akses dibuka sementara berdasarkan persetujuan."
                  : "Absensi masih dapat dilakukan."}
            </p>
            <button className="secondary" onClick={()=>setShowReopenForm(value=>!value)}>
              {showReopenForm ? "Tutup Form Pengajuan" : "Ajukan Pembukaan Absensi"}
            </button>
            {showReopenForm && (
              <div className="reopen-request-form">
                <label>
                  Absensi yang ingin dibuka
                <select value={reopenType} onChange={(e)=>setReopenType(e.target.value)}>
                  <option>Absen Masuk</option>
                  <option>Absen Pulang</option>
                </select>
                </label>
                <label>
                  Alasan pengajuan
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Alasan terlambat mengisi absensi"
                  rows={3}
                />
                </label>
                <label>
                  Surat pernyataan pribadi <small>PDF/JPG/PNG · maksimal 5 MB</small>
                  <input key={statementInputKey} type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(e)=>setStatement(e.target.files?.[0]||null)}/>
                </label>
                <button
                  className="primary"
                  onClick={requestReopen}
                  disabled={saving}
                >
                  Ajukan Pembukaan
                </button>
              </div>
            )}
            {today?.reopen && (
              <div className="request-state">
                <b>{today.reopen.status}</b>
                <span>
                  {today.reopen.status === "Disetujui"
                    ? "Akses berlaku 1 jam sejak persetujuan."
                    : today.reopen.reason}
                </span>
              </div>
            )}
          </article>
          <article className="module-card full work-output-card">
            <div className="work-output-card-header">
              <span>OUTPUT PEKERJAAN</span>
              {today?.attendance?.checkOut && (
                <span className="work-output-saved-badge">
                  ✓ Tersimpan bersama jam pulang ({formatAttendanceClock(today.attendance.checkOut)})
                </span>
              )}
            </div>
            {today?.attendance?.workOutput ? (
              <div className="work-output-vertical-list">
                {parseWorkOutputItems(today.attendance.workOutput).map((item, idx) => (
                  <div key={idx} className="work-output-vertical-item">
                    <div className="work-output-item-header">
                      {item.num && (
                        <span className="work-output-badge-num">{item.num}</span>
                      )}
                      {item.time && (
                        <span className="work-output-badge-time">
                          🕒 {item.time}
                        </span>
                      )}
                      {item.output && (
                        <span className="work-output-badge-output">
                          <strong>Output:</strong> {item.output}
                        </span>
                      )}
                    </div>
                    <div className="work-output-item-body">
                      {item.title}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="work-output-empty">
                <h3>Belum ada output pekerjaan hari ini</h3>
              </div>
            )}
            <p className="work-output-card-hint">
              Output diisi saat Absen Pulang dan tersimpan bersama jam pulang.
            </p>
          </article>
        </div>
      )}
      {tab === "dl" && (
        <div className="attendance-module-grid">
          <article className="module-card">
            <span>INPUT DINAS LUAR</span>
            <h3>Catat DL sesuai surat tugas</h3>
            <div className="rule-note">
              <b>Perhitungan Hari DL</b>
              <p>
                DL dihitung berdasarkan hari kalender secara kontinu. Jumat
                sampai Minggu dihitung 3 hari, termasuk Sabtu, Minggu, dan hari
                libur.
              </p>
            </div>
            <div className="module-form">
              <label>
                Nomor surat tugas
                <input
                  value={dl.documentNumber}
                  onChange={(e) =>
                    setDl({ ...dl, documentNumber: e.target.value })
                  }
                  placeholder="Contoh: 094/123/ST/2026"
                />
              </label>
              <label>
                Tanggal surat tugas
                <input
                  type="date"
                  value={dl.documentDate}
                  onChange={(e) =>
                    setDl({ ...dl, documentDate: e.target.value })
                  }
                />
              </label>
              <label>
                Tanggal mulai
                <input
                  type="date"
                  value={dl.startDate}
                  onChange={(e) => setDl({ ...dl, startDate: e.target.value })}
                />
              </label>
              <label>
                Tanggal selesai
                <input
                  type="date"
                  min={dl.startDate}
                  value={dl.endDate}
                  onChange={(e) => setDl({ ...dl, endDate: e.target.value })}
                />
              </label>
              <label>
                Tempat tujuan
                <input
                  value={dl.destination}
                  onChange={(e) =>
                    setDl({ ...dl, destination: e.target.value })
                  }
                />
              </label>
              <label>
                Tujuan DL
                <textarea
                  rows={3}
                  value={dl.purpose}
                  onChange={(e) => setDl({ ...dl, purpose: e.target.value })}
                />
              </label>
              <label>
                Catatan opsional
                <textarea
                  rows={2}
                  value={dl.notes}
                  onChange={(e) => setDl({ ...dl, notes: e.target.value })}
                />
              </label>
              <button
                className="primary"
                onClick={() => addOther("DL")}
                disabled={saving}
              >
                Simpan Dinas Luar
              </button>
            </div>
          </article>
          <History records={records.filter((r) => r.type === "DL")} onDelete={deleteOther} />
        </div>
      )}
      {tab === "cuti" && (
        <div className="attendance-module-grid">
          <article className="module-card">
            <span>INPUT MANDIRI PEGAWAI</span>
            <h3>Catat Cuti Berdasarkan Izin Tertulis</h3>
            <div className="rule-note">
              <b>Perhitungan Hari Cuti</b>
              <p>
                Cuti hanya menghitung hari kerja. Sabtu, Minggu, dan hari libur
                resmi yang tercatat di sistem otomatis dilewati.
              </p>
            </div>
            <div className="module-form">
              <label>
                Jenis cuti
                <select
                  value={leave.leaveType}
                  onChange={(e) =>
                    setLeave({ ...leave, leaveType: e.target.value })
                  }
                >
                  {[
                    "Cuti Tahunan",
                    "Cuti Sakit",
                    "Cuti Melahirkan",
                    "Cuti Alasan Penting",
                    "Cuti Besar",
                    "Cuti di Luar Tanggungan",
                    "Lainnya",
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label>
                Nomor surat/izin tertulis
                <input
                  value={leave.documentNumber}
                  onChange={(e) =>
                    setLeave({ ...leave, documentNumber: e.target.value })
                  }
                />
              </label>
              <label>
                Tanggal surat/izin
                <input
                  type="date"
                  value={leave.documentDate}
                  onChange={(e) =>
                    setLeave({ ...leave, documentDate: e.target.value })
                  }
                />
              </label>
              <label>
                Tanggal mulai
                <input
                  type="date"
                  value={leave.startDate}
                  onChange={(e) =>
                    setLeave({ ...leave, startDate: e.target.value })
                  }
                />
              </label>
              <label>
                Tanggal selesai
                <input
                  type="date"
                  min={leave.startDate}
                  value={leave.endDate}
                  onChange={(e) =>
                    setLeave({ ...leave, endDate: e.target.value })
                  }
                />
              </label>
              <label>
                Keterangan/alasan cuti
                <textarea
                  rows={3}
                  value={leave.notes}
                  onChange={(e) =>
                    setLeave({ ...leave, notes: e.target.value })
                  }
                />
              </label>
              <button
                className="primary"
                onClick={() => addOther("Cuti")}
                disabled={saving}
              >
                Simpan Cuti Saya
              </button>
            </div>
          </article>
          <History records={records.filter((r) => r.type === "Cuti")} onDelete={deleteOther} />
        </div>
      )}
      {tab === "rekap" && (
        <div className="attendance-module-grid">
          <article className="module-card full">
            <span>PERIODE REKAP OTOMATIS</span>
            <div className="personal-recap-head">
              <h2>
                {recap?.period?.from || "—"} sampai {recap?.period?.to || "—"}
              </h2>
              <button
                className="primary"
                onClick={() => window.print()}
                disabled={!recap}
              >
                Cetak Rekap Saya
              </button>
            </div>
            <p>
              Cetakan hanya memuat data akun Anda dan ruang tanda tangan atasan
              langsung.
            </p>
            <div className="recap-summary">
              <div>
                <b>{recap?.regularRecap?.length || 0}</b>
                <span>Catatan reguler</span>
              </div>
              <div>
                <b>
                  {recap?.otherRecords?.filter((r: any) => r.type === "DL")
                    .length || 0}
                </b>
                <span>Dinas Luar</span>
              </div>
              <div>
                <b>
                  {recap?.otherRecords?.filter((r: any) => r.type === "Cuti")
                    .length || 0}
                </b>
                <span>Cuti</span>
              </div>
              <div>
                <b>{recap?.holidayRecap?.calendarHolidays?.length || 0}</b>
                <span>Hari libur tambahan</span>
              </div>
            </div>
          </article>
          <article className="module-card full">
            <span>RIWAYAT ABSENSI REGULER</span>
            <div className="recap-table">
              <table>
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Jam Masuk</th>
                    <th>Jam Pulang</th>
                    <th>Status</th>
                    <th>Terlambat</th>
                    <th>Pengganti</th>
                    <th className="col-work-output">Catatan Absen Pulang</th>
                  </tr>
                </thead>
                <tbody>
                  {recap?.regularRecap?.length ? (
                    recap.regularRecap.map((r: any) => (
                      <tr key={r.id}>
                        <td>{r.workDate}</td>
                        <td>{formatAttendanceClock(r.checkIn)}</td>
                        <td>{formatAttendanceClock(r.checkOut)}</td>
                        <td>{r.attendanceStatus}</td>
                        <td>{r.lateMinutes} mnt</td>
                        <td>{r.replacementMinutes} mnt</td>
                        <td className="cell-work-output">
                          <VerticalWorkOutput text={r.workOutput} />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7}>Belum ada data pada periode ini.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </div>
      )}
      <article className="personal-print-sheet">
        {recap?.printSettings?.header && (
          <div className="print-custom-header">
            {recap.printSettings.header}
          </div>
        )}
        <header>
          <div>
            <h1>REKAP ABSENSI PEGAWAI</h1>
            <p>
              Periode {recap?.period?.from || "—"} s.d.{" "}
              {recap?.period?.to || "—"}
            </p>
          </div>
          <b>e Kinerja</b>
        </header>
        <dl>
          <div>
            <dt>Nama</dt>
            <dd>{recap?.employee?.fullName || "—"}</dd>
          </div>
          <div>
            <dt>NIP/NIK</dt>
            <dd>{recap?.employee?.employeeNumber || "—"}</dd>
          </div>
          <div>
            <dt>Jabatan</dt>
            <dd>{recap?.employee?.position || "—"}</dd>
          </div>
          <div>
            <dt>Unit/Subbagian</dt>
            <dd>{recap?.employee?.unit || "—"}</dd>
          </div>
        </dl>
        <table>
          <thead>
            <tr>
              <th>No.</th>
              <th>Tanggal</th>
              <th>Jam Masuk</th>
              <th>Jam Pulang</th>
              <th>Status</th>
              <th>Terlambat</th>
              <th>Pengganti</th>
              <th className="col-work-output">Catatan Absen Pulang</th>
            </tr>
          </thead>
          <tbody>
            {recap?.regularRecap?.length ? (
              recap.regularRecap.map((r: any, i: number) => (
                <tr key={r.id}>
                  <td>{i + 1}</td>
                  <td>{r.workDate}</td>
                  <td>{formatAttendanceClock(r.checkIn)}</td>
                  <td>{formatAttendanceClock(r.checkOut)}</td>
                  <td>
                    {(
                      {
                        on_time: "Normal",
                        late: "Terlambat",
                        absent_late: "Tidak Masuk Kerja",
                      } as any
                    )[r.attendanceStatus] || r.attendanceStatus}
                  </td>
                  <td>{r.lateMinutes ? `${r.lateMinutes} menit` : "—"}</td>
                  <td>
                    {r.replacementMinutes
                      ? `${r.replacementMinutes} menit`
                      : "—"}
                  </td>
                  <td className="cell-work-output">
                    <VerticalWorkOutput text={r.workOutput} />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8}>
                  Belum ada data absensi reguler pada periode ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <section className="personal-other-print">
          <h3>Dinas Luar dan Cuti</h3>
          {recap?.otherRecords?.length ? (
            <table>
              <thead>
                <tr>
                  <th>Jenis</th>
                  <th>Periode</th>
                  <th>Durasi</th>
                  <th>Dokumen</th>
                  <th>Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {recap.otherRecords.map((r: any) => (
                  <tr key={r.id}>
                    <td>
                      {r.type}
                      {r.leaveType ? ` · ${r.leaveType}` : ""}
                    </td>
                    <td>
                      {r.startDate}–{r.endDate}
                    </td>
                    <td>{r.durationDays} hari</td>
                    <td>{r.documentNumber || "—"}</td>
                    <td>{r.destination || r.purpose || r.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>Tidak ada pencatatan DL/Cuti.</p>
          )}
        </section>
        <div className="print-dateline">
          {recap?.printSettings?.place || "Tempat belum diatur"},{" "}
          {new Date().toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric",
            timeZone: "Asia/Jakarta",
          })}
        </div>
        <footer className={["sekretaris", "ketua"].includes(recap?.employee?.position?.trim().toLowerCase() || "") ? "single" : ""}>
          <div>
            <p>Pegawai yang bersangkutan,</p>
            <strong>{recap?.employee?.fullName || "—"}</strong>
            <small>NIP/NIK {recap?.employee?.employeeNumber || "—"}</small>
          </div>
          {!["sekretaris", "ketua"].includes(recap?.employee?.position?.trim().toLowerCase() || "") && <div>
            <p>Atasan langsung,</p>
            <strong>{recap?.supervisor?.fullName || "Belum ditentukan"}</strong>
            <small>
              {recap?.supervisor?.employeeNumber
                ? `NIP/NIK ${recap.supervisor.employeeNumber}`
                : ""}
            </small>
          </div>}
        </footer>
      </article>
      {tab === "tim" && (
        <div className="attendance-module-grid">
          <article className="module-card full">
            <span>REKAP SESUAI KEWENANGAN</span>
            <h2>
              {teamRecap?.period?.from || "—"} sampai{" "}
              {teamRecap?.period?.to || "—"}
            </h2>
            <p>
              Ketua melihat dirinya dan Anggota. Sekretaris/Super Admin melihat
              administrasi lembaga. Atasan lain hanya melihat bawahan langsung.
            </p>
            <div className="recap-table">
              <table>
                <thead>
                  <tr>
                    <th>Pegawai</th>
                    <th>Jabatan/Unit</th>
                    <th>Jumlah Catatan</th>
                    <th>Normal</th>
                    <th>Terlambat</th>
                    <th>Tidak Masuk</th>
                    <th>Belum Pulang</th>
                  </tr>
                </thead>
                <tbody>
                  {teamRecap?.employees?.map((e) => {
                    const rr = teamRecap.records.filter(
                      (x) => x.employeeEmail === e.email,
                    );
                    return (
                      <tr key={e.id}>
                        <td>
                          <b>{e.fullName}</b>
                        </td>
                        <td>{e.position || e.unit}</td>
                        <td>{rr.length}</td>
                        <td>
                          {
                            rr.filter(
                              (x) => x.attendanceStatus === "on_time",
                            ).length
                          }
                        </td>
                        <td>
                          {
                            rr.filter((x) => x.attendanceStatus === "late")
                              .length
                          }
                        </td>
                        <td>
                          {
                            rr.filter(
                              (x) => x.attendanceStatus === "absent_late",
                            ).length
                          }
                        </td>
                        <td>{rr.filter((x) => !x.checkOut).length}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="recap-table">
              <table>
                <thead>
                  <tr>
                    <th>Pegawai</th>
                    <th>Tanggal</th>
                    <th>Jam Masuk</th>
                    <th>Jam Pulang</th>
                    <th>Status</th>
                    <th>Terlambat</th>
                    <th>Pengganti</th>
                    <th className="col-work-output">Catatan Absen Pulang</th>
                  </tr>
                </thead>
                <tbody>
                  {teamRecap?.records?.length ? (
                    teamRecap.records.map((r) => {
                      const employee = teamRecap.employees.find(
                        (e) => e.email === r.employeeEmail,
                      );
                      return (
                        <tr key={r.id}>
                          <td>{employee?.fullName || r.employeeEmail}</td>
                          <td>{r.workDate}</td>
                          <td>{formatAttendanceClock(r.checkIn)}</td>
                          <td>{formatAttendanceClock(r.checkOut)}</td>
                          <td>{r.attendanceStatus}</td>
                          <td>{r.lateMinutes} mnt</td>
                          <td>{r.replacementMinutes} mnt</td>
                          <td className="cell-work-output">
                            <VerticalWorkOutput text={r.workOutput} />
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8}>Belum ada data pada periode ini.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </div>
      )}
      {tab === "pembukaan" && (
        <div className="attendance-module-grid">
          <article className="module-card">
            <span>PERMINTAAN PEMBUKAAN</span>
            <h3>
              {pending.filter((r) => r.status === "Menunggu").length} menunggu
              keputusan
            </h3>
            <div className="request-list">
              {pending.filter((r) => r.status === "Menunggu").length ? (
                pending
                  .filter((r) => r.status === "Menunggu")
                  .map((r) => (
                    <div key={r.id}>
                      <b>{r.employeeName ? `${r.employeeName} (${r.employeePosition || r.employeeEmail})` : r.employeeEmail}</b>
                      <span>
                        {r.workDate} · {r.attendanceType||"Absensi"} · {r.reason}
                      </span>
                      {r.statementFileKey&&<a className="document-link" href={`/api/attendance/reopen/statement?id=${r.id}`} target="_blank" rel="noreferrer">Lihat surat pernyataan</a>}
                      <aside>
                        <button onClick={() => decide(r.id, "Ditolak")}>
                          Tolak
                        </button>
                        <button onClick={() => decide(r.id, "Disetujui")}>
                          Setujui 1 Jam
                        </button>
                      </aside>
                    </div>
                  ))
              ) : (
                <p>Tidak ada permintaan yang menunggu.</p>
              )}
            </div>
          </article>
          <article className="module-card">
            <span>ALUR PEMBUKAAN</span>
            <h3>Akses sementara 1 jam</h3>
            <ol>
              <li>Pegawai memilih jenis absensi, menulis alasan, dan melampirkan surat pernyataan.</li>
              <li>Atasan langsung memeriksa. Pengajuan Ketua dan Sekretaris diperiksa Super Admin.</li>
              <li>Jika disetujui, akses terbuka selama 1 jam.</li>
              <li>Semua tindakan masuk ke audit log.</li>
            </ol>
          </article>
        </div>
      )}
      {showCheckout && (
        <div
          className="modal-backdrop"
          onMouseDown={() => setShowCheckout(false)}
        >
          <div
            className="modal checkout-activity-modal"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <span>ABSEN PULANG</span>
            <h3>Konfirmasi Jam Pulang</h3>
            <p>
              {todayActivities.length > 0
                ? `Terdeteksi ${todayActivities.length} aktivitas yang telah Anda catat di Aktivitas Harian hari ini.`
                : "Ringkas hasil pekerjaan sebelum menyimpan jam pulang."}
            </p>

            {todayActivities.length > 0 ? (
              <div className="checkout-activity-list">
                <b>Aktivitas Hari Ini (Otomatis Terangkum):</b>
                <ul>
                  {todayActivities.map((act: any) => (
                    <li key={act.id}>
                      <span className="badge-time">{act.startTime}–{act.endTime}</span>
                      <strong>{act.title}</strong>
                      {act.output && <em className="badge-out">{act.output}</em>}
                    </li>
                  ))}
                </ul>
                <small className="checkout-note-hint">
                  Rangkuman di atas otomatis tersimpan ke catatan absensi kepulangan Anda.
                </small>
              </div>
            ) : (
              <div className="checkout-no-activity-notice">
                <p>
                  💡 <i>Anda belum mencatat aktivitas di menu <b>Aktivitas Harian</b> hari ini.</i>
                </p>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => {
                    setShowCheckout(false);
                    setTab("aktivitas");
                  }}
                  style={{ marginBottom: 12 }}
                >
                  Buka Aktivitas Harian Dulu
                </button>
              </div>
            )}

            <label>
              Output pekerjaan (opsional jika sudah terangkum di atas)
              <textarea
                value={workOutput}
                onChange={(e) => setWorkOutput(e.target.value)}
                rows={todayActivities.length ? 3 : 5}
                placeholder="Catatan tambahan hasil pekerjaan hari ini..."
              />
            </label>
            <div className="modal-actions">
              <button onClick={() => setShowCheckout(false)}>Batal</button>
              <button className="primary" onClick={checkOut} disabled={saving}>
                {saving ? "Menyimpan..." : "✓ Konfirmasi Absen Pulang"}
              </button>
            </div>
          </div>
        </div>
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
function History({ records, onDelete }: { records: Other[]; onDelete?: (id: number, type: string) => void }) {
  return (
    <article className="module-card">
      <span>RIWAYAT</span>
      <h3>{records.length} pencatatan</h3>
      <div className="other-history">
        {records.length ? (
          records.map((r) => (
            <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
              <div style={{ flex: 1 }}>
                <b>
                  {r.type}
                  {r.leaveType ? ` · ${r.leaveType}` : ""} · {r.startDate}–
                  {r.endDate}
                </b>
                <span>
                  {r.durationDays} hari · Surat {r.documentNumber || "—"} (
                  {r.documentDate || "—"})
                  {r.destination ? ` · ${r.destination}` : ""}
                </span>
                <small>{r.purpose || r.notes || "Tanpa catatan"}</small>
              </div>
              {onDelete && (
                <button
                  type="button"
                  className="danger"
                  style={{ fontSize: "10px", padding: "3px 7px", border: "1px solid #fca5a5", borderRadius: "5px", background: "#fef2f2", color: "#b91c1c", cursor: "pointer", whiteSpace: "nowrap" }}
                  onClick={() => onDelete(r.id, r.type)}
                  title="Hapus pencatatan"
                >
                  ✕ Hapus
                </button>
              )}
            </div>
          ))
        ) : (
          <p>Belum ada riwayat.</p>
        )}
      </div>
    </article>
  );
}
