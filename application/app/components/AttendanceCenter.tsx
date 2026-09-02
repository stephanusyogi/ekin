"use client";
import { useEffect, useState } from "react";

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
  checkOut: string | null;
  attendanceStatus: string;
  workOutput: string;
};
type TeamRecap = {
  period: { from: string; to: string };
  employees: TeamEmployee[];
  records: TeamAttendance[];
};
export default function AttendanceCenter() {
  const [today, setToday] = useState<Today | null>(null);
  const [records, setRecords] = useState<Other[]>([]);
  const [recap, setRecap] = useState<any>(null);
  const [teamRecap, setTeamRecap] = useState<TeamRecap | null>(null);
  const [pending, setPending] = useState<any[]>([]);
  const [role, setRole] = useState("user");
  const [tab, setTab] = useState<
    "hari-ini" | "dl" | "cuti" | "rekap" | "tim" | "pembukaan"
  >("hari-ini");
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [workOutput, setWorkOutput] = useState("");
  const todayDate = new Date().toISOString().slice(0, 10);
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
      const [a, o, r, t, p, m] = await Promise.all([
        fetch("/api/attendance"),
        fetch("/api/attendance/other"),
        fetch("/api/attendance/recap"),
        fetch("/api/attendance/team-recap"),
        fetch("/api/attendance/reopen?scope=team"),
        fetch("/api/me"),
      ]);
      if (a.ok) setToday(await a.json());
      if (o.ok) setRecords((await o.json()).records);
      if (r.ok) setRecap(await r.json());
      if (t.ok) setTeamRecap(await t.json());
      if (p.ok) setPending((await p.json()).requests);
      if (m.ok) setRole((await m.json()).user.role);
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
                  Masuk{" "}
                  {new Date(today.attendance.checkIn).toLocaleTimeString(
                    "id-ID",
                    {
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "Asia/Jakarta",
                    },
                  )}{" "}
                  · Terlambat {today.attendance.lateMinutes} menit
                </p>
                <p>
                  Pengganti {today.attendance.replacementMinutes} menit setelah
                  jam pulang · Pulang{" "}
                  {today.attendance.checkOut
                    ? new Date(today.attendance.checkOut).toLocaleTimeString(
                        "id-ID",
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: "Asia/Jakarta",
                        },
                      )
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
                onClick={() => setShowCheckout(true)}
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
          <article className="module-card full">
            <span>OUTPUT PEKERJAAN</span>
            <h3>
              {today?.attendance?.workOutput ||
                "Belum ada output pekerjaan hari ini"}
            </h3>
            <p>
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
          <History records={records.filter((r) => r.type === "DL")} />
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
          <History records={records.filter((r) => r.type === "Cuti")} />
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
                    <th>Catatan Absen Pulang</th>
                  </tr>
                </thead>
                <tbody>
                  {recap?.regularRecap?.length ? (
                    recap.regularRecap.map((r: any) => (
                      <tr key={r.id}>
                        <td>{r.workDate}</td>
                        <td>
                          {new Date(r.checkIn).toLocaleTimeString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                            timeZone: "Asia/Jakarta",
                          })}
                        </td>
                        <td>
                          {r.checkOut
                            ? new Date(r.checkOut).toLocaleTimeString("id-ID", {
                                hour: "2-digit",
                                minute: "2-digit",
                                timeZone: "Asia/Jakarta",
                              })
                            : "—"}
                        </td>
                        <td>{r.attendanceStatus}</td>
                        <td>{r.lateMinutes} mnt</td>
                        <td>{r.replacementMinutes} mnt</td>
                        <td>{r.workOutput || "—"}</td>
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
              <th>Catatan Absen Pulang</th>
            </tr>
          </thead>
          <tbody>
            {recap?.regularRecap?.length ? (
              recap.regularRecap.map((r: any, i: number) => (
                <tr key={r.id}>
                  <td>{i + 1}</td>
                  <td>{r.workDate}</td>
                  <td>
                    {new Date(r.checkIn).toLocaleTimeString("id-ID", {
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "Asia/Jakarta",
                    })}
                  </td>
                  <td>
                    {r.checkOut
                      ? new Date(r.checkOut).toLocaleTimeString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: "Asia/Jakarta",
                        })
                      : "—"}
                  </td>
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
                  <td>{r.workOutput || "—"}</td>
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
        <footer className={recap?.employee?.position?.trim().toLowerCase() === "sekretaris" ? "single" : ""}>
          <div>
            <p>Pegawai yang bersangkutan,</p>
            <strong>{recap?.employee?.fullName || "—"}</strong>
            <small>NIP/NIK {recap?.employee?.employeeNumber || "—"}</small>
          </div>
          {recap?.employee?.position?.trim().toLowerCase() !== "sekretaris" && <div>
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
                    <th>Tanggal</th>
                    <th>Pegawai</th>
                    <th>Jam Pulang</th>
                    <th>Catatan Absen Pulang</th>
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
                          <td>{r.workDate}</td>
                          <td>{employee?.fullName || r.employeeEmail}</td>
                          <td>
                            {r.checkOut
                              ? new Date(r.checkOut).toLocaleTimeString(
                                  "id-ID",
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    timeZone: "Asia/Jakarta",
                                  },
                                )
                              : "Belum absen pulang"}
                          </td>
                          <td>{r.workOutput || "—"}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4}>Belum ada data pada periode ini.</td>
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
                      <b>{r.employeeEmail}</b>
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
            className="modal"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <span>ABSEN PULANG</span>
            <h3>Output Pekerjaan Hari Ini</h3>
            <p>Ringkas hasil pekerjaan sebelum menyimpan jam pulang.</p>
            <label>
              Output pekerjaan
              <textarea
                autoFocus
                value={workOutput}
                onChange={(e) => setWorkOutput(e.target.value)}
                rows={5}
                placeholder="Contoh: Menyelesaikan rekap kegiatan dan mengirim bahan verifikasi."
              />
            </label>
            <div className="modal-actions">
              <button onClick={() => setShowCheckout(false)}>Batal</button>
              <button className="primary" onClick={checkOut} disabled={saving}>
                {saving ? "Menyimpan..." : "Simpan & Absen Pulang"}
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
function History({ records }: { records: Other[] }) {
  return (
    <article className="module-card">
      <span>RIWAYAT</span>
      <h3>{records.length} pencatatan</h3>
      <div className="other-history">
        {records.length ? (
          records.map((r) => (
            <div key={r.id}>
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
          ))
        ) : (
          <p>Belum ada riwayat.</p>
        )}
      </div>
    </article>
  );
}
