"use client";
import { useEffect, useMemo, useState } from "react";
type Report = {
  period: { from: string; to: string };
  printSettings: { header: string; place: string };
  generatedBy: { name: string };
  employees: any[];
  records: any[];
  otherRecords: any[];
  holidays: any[];
};
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const initialPeriod = () => {
  const n = new Date(),
    end = new Date(
      n.getFullYear(),
      n.getMonth() + (n.getDate() >= 21 ? 1 : 0),
      20,
    ),
    start = new Date(end.getFullYear(), end.getMonth() - 1, 21);
  return { from: iso(start), to: iso(end) };
};
const clock = (v?: string | null) =>
  v
    ? new Date(v).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jakarta",
      })
    : "—";
const dateLabel = (v: string) =>
  new Date(`${v}T00:00:00`).toLocaleDateString("id-ID", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
export default function MonthlyAttendanceReport() {
  const initial = initialPeriod(),
    [from, setFrom] = useState(initial.from),
    [to, setTo] = useState(initial.to),
    [data, setData] = useState<Report | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [query, setQuery] = useState(""),
    [unit, setUnit] = useState("Semua"),
    [employeeId, setEmployeeId] = useState("Semua"),
    [status, setStatus] = useState("Semua");
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch(
          `/api/attendance/monthly-report?from=${from}&to=${to}`,
        ),
        j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setData(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Laporan belum dapat dimuat");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);
  const units = useMemo(
    () =>
      [
        ...new Set((data?.employees || []).map((e) => e.unit).filter(Boolean)),
      ].sort() as string[],
    [data],
  );
  const days = useMemo(() => {
    if (!data) return [];
    const holidays = new Set(data.holidays.map((h) => h.holidayDate)),
      out: string[] = [];
    for (
      let d = new Date(`${data.period.from}T00:00:00`),
        last = new Date(`${data.period.to}T00:00:00`);
      d <= last;
      d.setDate(d.getDate() + 1)
    ) {
      const key = iso(d);
      if (d.getDay() !== 0 && d.getDay() !== 6 && !holidays.has(key))
        out.push(key);
    }
    return out;
  }, [data]);
  const reports = useMemo(
    () =>
      !data
        ? []
        : data.employees.map((employee) => {
            const regular = new Map(
              data.records
                .filter((r) => r.employeeEmail === employee.email)
                .map((r) => [r.workDate, r]),
            );
            const rows = days.map((day) => {
              const record: any = regular.get(day),
                other = data.otherRecords.find(
                  (o) =>
                    o.employeeEmail === employee.email &&
                    o.startDate <= day &&
                    o.endDate >= day,
                );
              let label = "Tidak Absen Pagi";
              if (other) label = other.type;
              else if (record?.attendanceStatus === "on_time") label = "Normal";
              else if (record?.attendanceStatus === "late")
                label = record.checkOut
                  ? "Normal (ganti terpenuhi)"
                  : "Terlambat";
              else if (record?.attendanceStatus === "absent_late")
                label = "Tidak Masuk Kerja";
              if (record && !record.checkOut)
                label =
                  label === "Normal"
                    ? "Tidak Absen Pulang"
                    : `${label} · Tidak Absen Pulang`;
              return { day, record, other, label };
            });
            const counts = {
              normal: rows.filter((r) => r.label.startsWith("Normal")).length,
              late: rows.filter((r) => r.label.includes("Terlambat")).length,
              absent: rows.filter(
                (r) =>
                  r.label.includes("Tidak Absen Pagi") ||
                  r.label.includes("Tidak Masuk Kerja"),
              ).length,
              dl: rows.filter((r) => r.other?.type === "DL").length,
              leave: rows.filter((r) => r.other?.type === "Cuti").length,
            };
            return {
              employee,
              rows,
              counts,
              supervisor: data.employees.find(
                (e) => e.id === employee.directSupervisorId,
              ),
            };
          }),
    [data, days],
  );
  const filtered = reports.filter(
    (x) =>
      (unit === "Semua" || x.employee.unit === unit) &&
      (employeeId === "Semua" || String(x.employee.id) === employeeId) &&
      `${x.employee.fullName} ${x.employee.employeeNumber}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (status === "Semua" || x.rows.some((r) => r.label.includes(status))),
  );
  const totals = filtered.reduce(
    (a, x) => ({
      normal: a.normal + x.counts.normal,
      late: a.late + x.counts.late,
      absent: a.absent + x.counts.absent,
      dl: a.dl + x.counts.dl,
      leave: a.leave + x.counts.leave,
    }),
    { normal: 0, late: 0, absent: 0, dl: 0, leave: 0 },
  );
  return (
    <section className="monthly-report-page">
      <div className="page-title no-print">
        <div>
          <p>REKAP BULANAN 21–20</p>
          <h1>Rekap & Cetak Absensi</h1>
          <span>
            Operator dapat menyiapkan laporan seluruh pegawai untuk
            penandatanganan.
          </span>
        </div>
        <button
          className="primary"
          onClick={() => window.print()}
          disabled={!filtered.length}
        >
          Cetak Laporan
        </button>
      </div>
      <div className="report-controls no-print">
        <label>
          Dari
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          Sampai
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <button className="primary" onClick={load}>
          Terapkan
        </button>
        <label>
          Cari Pegawai
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nama atau NIP/NIK"
          />
        </label>
        <label>
          Unit
          <select value={unit} onChange={(e) => setUnit(e.target.value)}>
            <option>Semua</option>
            {units.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          Pegawai
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
          >
            <option>Semua</option>
            {data?.employees.map((e) => (
              <option value={e.id} key={e.id}>
                {e.fullName}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option>Semua</option>
            <option>Normal</option>
            <option>Terlambat</option>
            <option>Tidak Absen</option>
            <option>Tidak Masuk Kerja</option>
            <option>DL</option>
            <option>Cuti</option>
          </select>
        </label>
      </div>
      {error && <div className="report-error">{error}</div>}
      {loading ? (
        <div className="report-empty">Menyiapkan laporan…</div>
      ) : (
        <>
          <div className="report-summary no-print">
            <article>
              <b>{filtered.length}</b>
              <span>Pegawai</span>
            </article>
            <article>
              <b>{totals.normal}</b>
              <span>Normal</span>
            </article>
            <article>
              <b>{totals.late}</b>
              <span>Terlambat</span>
            </article>
            <article>
              <b>{totals.absent}</b>
              <span>Tidak Hadir/Absen</span>
            </article>
            <article>
              <b>{totals.dl}</b>
              <span>Hari DL</span>
            </article>
            <article>
              <b>{totals.leave}</b>
              <span>Hari Cuti</span>
            </article>
          </div>
          <div className="print-cover">
            <h1>REKAPITULASI ABSENSI PEGAWAI</h1>
            <p>
              Periode {dateLabel(data?.period.from || from)} s.d.{" "}
              {dateLabel(data?.period.to || to)}
            </p>
            <small>
              Dicetak oleh {data?.generatedBy.name} ·{" "}
              {new Date().toLocaleString("id-ID")}
            </small>
          </div>
          {!filtered.length ? (
            <div className="report-empty">
              Tidak ada pegawai yang sesuai dengan filter.
            </div>
          ) : (
            filtered.map(({ employee, rows, counts, supervisor }) => (
              <article className="employee-report-sheet" key={employee.id}>
                {data?.printSettings?.header && (
                  <div className="print-custom-header">
                    {data.printSettings.header}
                  </div>
                )}
                <header className="report-letterhead">
                  <div>
                    <h2>REKAP ABSENSI PEGAWAI</h2>
                    <p>
                      Periode {dateLabel(data!.period.from)} s.d.{" "}
                      {dateLabel(data!.period.to)}
                    </p>
                  </div>
                  <span>e Kinerja</span>
                </header>
                <dl className="report-identity">
                  <div>
                    <dt>Nama</dt>
                    <dd>{employee.fullName}</dd>
                  </div>
                  <div>
                    <dt>NIP/NIK</dt>
                    <dd>{employee.employeeNumber}</dd>
                  </div>
                  <div>
                    <dt>Jabatan</dt>
                    <dd>{employee.position || "—"}</dd>
                  </div>
                  <div>
                    <dt>Unit/Subbagian</dt>
                    <dd>{employee.unit || "—"}</dd>
                  </div>
                </dl>
                <div className="sheet-summary">
                  <span>
                    Normal <b>{counts.normal}</b>
                  </span>
                  <span>
                    Terlambat <b>{counts.late}</b>
                  </span>
                  <span>
                    Tidak hadir/absen <b>{counts.absent}</b>
                  </span>
                  <span>
                    DL <b>{counts.dl}</b>
                  </span>
                  <span>
                    Cuti <b>{counts.leave}</b>
                  </span>
                </div>
                <div className="report-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>No.</th>
                        <th>Tanggal</th>
                        <th>Masuk</th>
                        <th>Pulang</th>
                        <th>Terlambat</th>
                        <th>Pengganti</th>
                        <th>Keterangan</th>
                        <th>Output Pekerjaan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={r.day}>
                          <td>{i + 1}</td>
                          <td>{dateLabel(r.day)}</td>
                          <td>{r.other ? "—" : clock(r.record?.checkIn)}</td>
                          <td>{r.other ? "—" : clock(r.record?.checkOut)}</td>
                          <td>
                            {r.record?.lateMinutes
                              ? `${r.record.lateMinutes} menit`
                              : "—"}
                          </td>
                          <td>
                            {r.record?.replacementMinutes
                              ? `${r.record.replacementMinutes} menit`
                              : "—"}
                          </td>
                          <td>{r.label}</td>
                          <td>
                            {r.other
                              ? r.other.type === "DL"
                                ? `${r.other.destination} · ${r.other.purpose}`
                                : `${r.other.leaveType || "Cuti"} · ${r.other.documentNumber || "dokumen tercatat"}`
                              : r.record?.workOutput || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="print-dateline">
                  {data?.printSettings?.place || "Tempat belum diatur"},{" "}
                  {new Date().toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    timeZone: "Asia/Jakarta",
                  })}
                </div>
                <div className={`report-signatures ${employee.position?.trim().toLowerCase() === "sekretaris" ? "single" : ""}`}>
                  <div>
                    <p>Pegawai yang bersangkutan,</p>
                    <strong>{employee.fullName}</strong>
                    <small>NIP/NIK {employee.employeeNumber}</small>
                  </div>
                  {employee.position?.trim().toLowerCase() !== "sekretaris" && <div>
                    <p>Atasan langsung,</p>
                    <strong>
                      {supervisor?.fullName || "Belum ditentukan"}
                    </strong>
                    <small>
                      {supervisor?.employeeNumber
                        ? `NIP/NIK ${supervisor.employeeNumber}`
                        : ""}
                    </small>
                  </div>}
                </div>
              </article>
            ))
          )}
        </>
      )}
    </section>
  );
}
