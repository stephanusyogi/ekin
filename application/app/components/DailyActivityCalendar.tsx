"use client";
import { useEffect, useMemo, useState } from "react";
import TimeInput24 from "./TimeInput24";

export type DailyActivity = {
  id: number;
  employeeEmail: string;
  activityDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  title: string;
  description: string;
  output: string;
  category: string;
  location: string;
  color: string;
  notes: string;
  evidenceLinks?: string[];
};

const START_HOUR = 6; // 06:00
const END_HOUR = 20; // 20:00
const HOUR_HEIGHT = 64; // pixels per hour

const CATEGORIES = [
  "Tugas Utama",
  "Rapat / Koordinasi",
  "Layanan & Administrasi",
  "Sosialisasi & Parmas",
  "Teknis & Verifikasi",
  "Lain-lain",
];

const COLOR_PRESETS = [
  { name: "Emerald", hex: "#10b981", bg: "#ecfdf5", border: "#6ee7b7", text: "#065f46" },
  { name: "Sky Blue", hex: "#0284c7", bg: "#f0f9ff", border: "#7dd3fc", text: "#0c4a6e" },
  { name: "Amber", hex: "#f59e0b", bg: "#fffbeb", border: "#fde68a", text: "#78350f" },
  { name: "Purple", hex: "#8b5cf6", bg: "#f5f3ff", border: "#c4b5fd", text: "#4c1d95" },
  { name: "Rose", hex: "#f43f5e", bg: "#fff1f2", border: "#fecdd3", text: "#881337" },
  { name: "Slate", hex: "#64748b", bg: "#f8fafc", border: "#cbd5e1", text: "#1e293b" },
];

function getJakartaDate(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "0";
  return new Date(
    Number(get("year")),
    Number(get("month")) - 1,
    Number(get("day")),
    Number(get("hour")),
    Number(get("minute")),
    Number(get("second")),
  );
}

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function timeToMinutes(t: string): number {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export default function DailyActivityCalendar({
  onActivityChanged,
}: {
  onActivityChanged?: () => void;
}) {
  const [viewMode, setViewMode] = useState<"day" | "week">("day");
  const [currentDate, setCurrentDate] = useState<Date>(getJakartaDate);
  const [activities, setActivities] = useState<DailyActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingActivity, setEditingActivity] = useState<DailyActivity | null>(null);
  const [form, setForm] = useState<{
    activityDate: string;
    startTime: string;
    endTime: string;
    title: string;
    description: string;
    output: string;
    category: string;
    location: string;
    color: string;
    notes: string;
    evidenceLinks: string[];
  }>({
    activityDate: fmtDate(getJakartaDate()),
    startTime: "08:00",
    endTime: "09:00",
    title: "",
    description: "",
    output: "",
    category: "Tugas Utama",
    location: "Kantor Utama",
    color: "#10b981",
    notes: "",
    evidenceLinks: [""],
  });
  const [saving, setSaving] = useState(false);

  // Live clock for red line indicator
  const [nowJakarta, setNowJakarta] = useState<Date>(getJakartaDate);

  useEffect(() => {
    const timer = setInterval(() => {
      setNowJakarta(getJakartaDate());
    }, 30000); // update every 30s
    return () => clearInterval(timer);
  }, []);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  // Calculate visible date range
  const { startDate, endDate, weekDays } = useMemo(() => {
    if (viewMode === "day") {
      const dStr = fmtDate(currentDate);
      return { startDate: dStr, endDate: dStr, weekDays: [new Date(currentDate)] };
    }
    // Week view: start from Sunday
    const d = new Date(currentDate);
    const dayOfWeek = d.getDay(); // 0 is Sunday
    const start = new Date(d);
    start.setDate(d.getDate() - dayOfWeek);
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const next = new Date(start);
      next.setDate(start.getDate() + i);
      days.push(next);
    }
    return {
      startDate: fmtDate(days[0]),
      endDate: fmtDate(days[6]),
      weekDays: days,
    };
  }, [viewMode, currentDate]);

  const loadActivities = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/attendance/activities?from=${startDate}&to=${endDate}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActivities(data.activities || []);
    } catch {
      notify("Gagal memuat aktivitas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, [startDate, endDate]);

  // Navigation handlers
  const goToday = () => setCurrentDate(getJakartaDate());
  const goPrev = () => {
    const next = new Date(currentDate);
    if (viewMode === "day") {
      next.setDate(next.getDate() - 1);
    } else {
      next.setDate(next.getDate() - 7);
    }
    setCurrentDate(next);
  };
  const goNext = () => {
    const next = new Date(currentDate);
    if (viewMode === "day") {
      next.setDate(next.getDate() + 1);
    } else {
      next.setDate(next.getDate() + 7);
    }
    setCurrentDate(next);
  };

  // Open modal to add activity at specific date and hour
  const handleOpenAdd = (dateStr?: string, startHour?: number) => {
    const dStr = dateStr || fmtDate(currentDate);
    const h = startHour !== undefined ? startHour : 8;
    const sTime = `${String(h).padStart(2, "0")}:00`;
    const eTime = `${String(Math.min(23, h + 1)).padStart(2, "0")}:00`;
    setEditingActivity(null);
    setForm({
      activityDate: dStr,
      startTime: sTime,
      endTime: eTime,
      title: "",
      description: "",
      output: "",
      category: "Tugas Utama",
      location: "Kantor Utama",
      color: "#10b981",
      notes: "",
      evidenceLinks: [""],
    });
    setShowModal(true);
  };

  // Open modal to edit existing activity
  const handleOpenEdit = (act: DailyActivity, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingActivity(act);
    setForm({
      activityDate: act.activityDate,
      startTime: act.startTime,
      endTime: act.endTime,
      title: act.title,
      description: act.description,
      output: act.output,
      category: act.category,
      location: act.location,
      color: act.color || "#10b981",
      notes: act.notes || "",
      evidenceLinks:
        act.evidenceLinks && act.evidenceLinks.length > 0
          ? act.evidenceLinks
          : [""],
    });
    setShowModal(true);
  };

  // Save activity (create or update)
  const handleSave = async () => {
    if (!form.title.trim()) {
      notify("Judul aktivitas wajib diisi");
      return;
    }
    if (!form.startTime || !form.endTime) {
      notify("Jam mulai dan jam selesai wajib diisi");
      return;
    }
    if (timeToMinutes(form.startTime) >= timeToMinutes(form.endTime)) {
      notify("Jam selesai harus lebih akhir dari jam mulai");
      return;
    }

    setSaving(true);
    try {
      const isEdit = Boolean(editingActivity?.id);
      const cleanedLinks = form.evidenceLinks
        .map((s) => s.trim())
        .filter(Boolean);
      const payload = {
        ...form,
        evidenceLinks: cleanedLinks,
        ...(isEdit ? { id: editingActivity!.id } : {}),
      };
      const res = await fetch("/api/attendance/activities", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      notify(isEdit ? "Aktivitas berhasil diperbarui" : "Aktivitas berhasil dicatat");
      setShowModal(false);
      await loadActivities();
      if (onActivityChanged) onActivityChanged();
    } catch (e: any) {
      notify(e.message || "Gagal menyimpan aktivitas");
    } finally {
      setSaving(false);
    }
  };

  // Delete activity
  const handleDelete = async () => {
    if (!editingActivity?.id) return;
    if (!confirm("Hapus aktivitas ini?")) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/attendance/activities?id=${editingActivity.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      notify("Aktivitas berhasil dihapus");
      setShowModal(false);
      await loadActivities();
      if (onActivityChanged) onActivityChanged();
    } catch (e: any) {
      notify(e.message || "Gagal menghapus aktivitas");
    } finally {
      setSaving(false);
    }
  };

  // Calculate total hours for a day
  const calculateTotalMinutesForDate = (dateStr: string) => {
    const dayActs = activities.filter((a) => a.activityDate === dateStr);
    return dayActs.reduce((acc, a) => {
      const diff = Math.max(0, timeToMinutes(a.endTime) - timeToMinutes(a.startTime));
      return acc + diff;
    }, 0);
  };

  // Red line indicator position
  const todayStr = fmtDate(nowJakarta);
  const nowMinutes = nowJakarta.getHours() * 60 + nowJakarta.getMinutes();
  const redLineTop = ((nowMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;
  const isRedLineVisible = nowMinutes >= START_HOUR * 60 && nowMinutes <= END_HOUR * 60;

  // Header Title
  const headerTitle = useMemo(() => {
    if (viewMode === "day") {
      return currentDate.toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    }
    const m1 = weekDays[0].toLocaleDateString("id-ID", { month: "long" });
    const m2 = weekDays[6].toLocaleDateString("id-ID", { month: "long" });
    const y1 = weekDays[0].getFullYear();
    const y2 = weekDays[6].getFullYear();
    if (m1 === m2 && y1 === y2) {
      return `${m1} ${y1}`;
    }
    return `${m1} ${y1} – ${m2} ${y2}`;
  }, [viewMode, currentDate, weekDays]);

  // Hours array for rows (06:00 to 20:00)
  const hours = useMemo(() => {
    const arr: number[] = [];
    for (let h = START_HOUR; h <= END_HOUR; h++) {
      arr.push(h);
    }
    return arr;
  }, []);

  return (
    <div className="gcal-wrapper">
      {/* Top Bar Header */}
      <header className="gcal-header">
        <div className="gcal-header-left">
          <button className="gcal-btn gcal-today-btn" onClick={goToday}>
            Hari Ini
          </button>
          <div className="gcal-nav-buttons">
            <button className="gcal-icon-btn" onClick={goPrev} title="Sebelumnya">
              ‹
            </button>
            <button className="gcal-icon-btn" onClick={goNext} title="Berikutnya">
              ›
            </button>
          </div>
          <h2 className="gcal-title">{headerTitle}</h2>
        </div>

        <div className="gcal-header-right">
          <div className="gcal-hours-badge">
            {viewMode === "day" && (() => {
              const totalMins = calculateTotalMinutesForDate(fmtDate(currentDate));
              const hrs = (totalMins / 60).toFixed(1);
              return (
                <span className={totalMins >= 450 ? "badge-success" : "badge-info"}>
                  Total: <b>{hrs} jam</b> / 7.5 jam target
                </span>
              );
            })()}
          </div>

          <div className="gcal-view-toggle">
            <button
              className={`gcal-toggle-btn ${viewMode === "day" ? "active" : ""}`}
              onClick={() => setViewMode("day")}
            >
              Day
            </button>
            <button
              className={`gcal-toggle-btn ${viewMode === "week" ? "active" : ""}`}
              onClick={() => setViewMode("week")}
            >
              Week
            </button>
          </div>

          <button className="gcal-btn gcal-add-btn" onClick={() => handleOpenAdd()}>
            ＋ Catat Aktivitas
          </button>
        </div>
      </header>

      {/* Main Calendar View Container */}
      <div className="gcal-container">
        {/* Sticky Days Header Row */}
        <div className="gcal-day-header-row">
          <div className="gcal-timezone-cell">
            <span>WIB</span>
          </div>

          <div className="gcal-day-columns-header">
            {weekDays.map((d) => {
              const dStr = fmtDate(d);
              const isToday = dStr === todayStr;
              const dayTotalMins = calculateTotalMinutesForDate(dStr);
              return (
                <div
                  key={dStr}
                  className={`gcal-day-header-cell ${isToday ? "is-today" : ""}`}
                  onClick={() => {
                    if (viewMode === "week") {
                      setCurrentDate(d);
                      setViewMode("day");
                    }
                  }}
                >
                  <span className="gcal-weekday-label">
                    {d.toLocaleDateString("id-ID", { weekday: "short" }).toUpperCase()}
                  </span>
                  <div className={`gcal-date-circle ${isToday ? "today-circle" : ""}`}>
                    {d.getDate()}
                  </div>
                  {viewMode === "week" && dayTotalMins > 0 && (
                    <small className="gcal-day-hours">
                      {(dayTotalMins / 60).toFixed(1)}j
                    </small>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Scrollable Hours Grid */}
        <div className="gcal-scroll-area">
          <div className="gcal-grid-layout">
            {/* Left Time Gutter */}
            <div className="gcal-time-gutter">
              {hours.map((h) => (
                <div key={h} className="gcal-time-label" style={{ height: HOUR_HEIGHT }}>
                  <span>{`${String(h).padStart(2, "0")}.00`}</span>
                </div>
              ))}
            </div>

            {/* Day Columns Grid */}
            <div className="gcal-columns-grid">
              {/* Horizontal Hour Lines Background */}
              <div className="gcal-hour-lines">
                {hours.map((h) => (
                  <div
                    key={h}
                    className="gcal-hour-line"
                    style={{ height: HOUR_HEIGHT }}
                  />
                ))}
              </div>

              {/* Day Columns */}
              <div className="gcal-day-columns">
                {weekDays.map((d) => {
                  const dStr = fmtDate(d);
                  const isToday = dStr === todayStr;
                  const dayActivities = activities.filter(
                    (a) => a.activityDate === dStr,
                  );

                  return (
                    <div
                      key={dStr}
                      className={`gcal-day-column ${isToday ? "today-column" : ""}`}
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const offsetY = e.clientY - rect.top;
                        const clickedHour = Math.floor(offsetY / HOUR_HEIGHT) + START_HOUR;
                        handleOpenAdd(dStr, Math.min(END_HOUR, Math.max(START_HOUR, clickedHour)));
                      }}
                    >
                      {/* Red Current Time Line Indicator */}
                      {isToday && isRedLineVisible && (
                        <div
                          className="gcal-current-time-line"
                          style={{ top: redLineTop }}
                        >
                          <div className="gcal-red-dot" />
                          <div className="gcal-red-rule" />
                        </div>
                      )}

                      {/* Render Events */}
                      {dayActivities.map((act) => {
                        const startMin = timeToMinutes(act.startTime);
                        const endMin = timeToMinutes(act.endTime);
                        const top = ((startMin - START_HOUR * 60) / 60) * HOUR_HEIGHT;
                        const durationMins = Math.max(25, endMin - startMin);
                        const height = Math.max(28, (durationMins / 60) * HOUR_HEIGHT);

                        // Color theme lookup
                        const preset =
                          COLOR_PRESETS.find((c) => c.hex === act.color) ||
                          COLOR_PRESETS[0];

                        return (
                          <div
                            key={act.id}
                            className="gcal-event-block"
                            style={{
                              top,
                              height,
                              backgroundColor: preset.bg,
                              borderColor: preset.border,
                              borderLeftColor: preset.hex,
                              color: preset.text,
                            }}
                            onClick={(e) => handleOpenEdit(act, e)}
                            title={`${act.title} (${act.startTime}–${act.endTime})\nOutput: ${act.output || "—"}`}
                          >
                            <div className="gcal-event-header">
                              <span className="gcal-event-time">
                                {act.startTime} – {act.endTime}
                              </span>
                              {act.output && (
                                <span className="gcal-event-output">
                                  {act.output}
                                </span>
                              )}
                            </div>
                            <strong className="gcal-event-title">{act.title}</strong>
                            {height >= 55 && act.description && (
                              <p className="gcal-event-desc">{act.description}</p>
                            )}
                            {height >= 75 && (
                              <div className="gcal-event-footer">
                                <span className="gcal-event-cat">{act.category}</span>
                                {act.location && (
                                  <span className="gcal-event-loc">📍 {act.location}</span>
                                )}
                              </div>
                            )}
                            {act.evidenceLinks && act.evidenceLinks.length > 0 && (
                              <div
                                className="gcal-event-links"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {act.evidenceLinks.map((link, idx) => (
                                  <a
                                    key={idx}
                                    href={link}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="gcal-link-pill"
                                    title={link}
                                  >
                                    🔗 Bukti {act.evidenceLinks!.length > 1 ? idx + 1 : ""}
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Input / Edit Activity */}
      {showModal && (
        <div className="modal-backdrop" onMouseDown={() => setShowModal(false)}>
          <div
            className="modal gcal-modal"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="gcal-modal-header">
              <div>
                <span className="gcal-modal-kicker">AKTIVITAS HARIAN</span>
                <h3>{editingActivity ? "Edit Aktivitas" : "Catat Aktivitas Baru"}</h3>
              </div>
              <button className="gcal-modal-close" onClick={() => setShowModal(false)}>
                ✕
              </button>
            </div>

            <div className="module-form two-col">
              <label>
                Tanggal
                <input
                  type="date"
                  value={form.activityDate}
                  onChange={(e) => setForm({ ...form, activityDate: e.target.value })}
                />
              </label>

              <label>
                Kategori Pekerjaan
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat}>{cat}</option>
                  ))}
                </select>
              </label>

              <label>
                Jam Mulai
                <TimeInput24
                  value={form.startTime}
                  onChange={(val) => setForm({ ...form, startTime: val })}
                />
              </label>

              <label>
                Jam Selesai
                <TimeInput24
                  value={form.endTime}
                  onChange={(val) => setForm({ ...form, endTime: val })}
                />
              </label>

              <label className="wide">
                Nama / Uraian Singkat Aktivitas
                <input
                  value={form.title}
                  placeholder="Contoh: Verifikasi berkas kelengkapan caleg"
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </label>

              <label>
                Kuantitas / Output Hasil
                <input
                  value={form.output}
                  placeholder="Contoh: 5 Berkas / 1 Notula"
                  onChange={(e) => setForm({ ...form, output: e.target.value })}
                />
              </label>

              <label>
                Lokasi / Tempat
                <input
                  value={form.location}
                  placeholder="Contoh: Kantor Utama / Ruang Rapat"
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </label>

              <label className="wide">
                Rincian Uraian Kegiatan (Opsional)
                <textarea
                  rows={2}
                  value={form.description}
                  placeholder="Jelaskan secara ringkas hasil pekerjaan yang dilaksanakan..."
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </label>

              <label className="wide">
                Catatan Tambahan (Opsional)
                <textarea
                  rows={2}
                  value={form.notes}
                  placeholder="Catatan kendala, tindak lanjut, atau keterangan khusus..."
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </label>

              <div className="wide gcal-evidence-section">
                <div className="gcal-evidence-header">
                  <div className="gcal-evidence-label">
                    <span>Link Bukti Dukung (Opsional)</span>
                    <small>Lampirkan Google Drive, spreadsheet, dokumen, atau tautan bukti kegiatan</small>
                  </div>
                  <button
                    type="button"
                    className="gcal-add-link-btn"
                    onClick={() =>
                      setForm({
                        ...form,
                        evidenceLinks: [...form.evidenceLinks, ""],
                      })
                    }
                  >
                    + Tambah Link Bukti
                  </button>
                </div>

                <div className="gcal-evidence-list">
                  {form.evidenceLinks.map((link, idx) => (
                    <div key={idx} className="gcal-evidence-row">
                      <span className="gcal-evidence-icon">🔗</span>
                      <input
                        type="url"
                        value={link}
                        placeholder={
                          idx === 0
                            ? "Contoh: https://docs.google.com/spreadsheets/d/... atau https://drive.google.com/..."
                            : `Link Bukti Dukung ke-${idx + 1}...`
                        }
                        onChange={(e) => {
                          const next = [...form.evidenceLinks];
                          next[idx] = e.target.value;
                          setForm({ ...form, evidenceLinks: next });
                        }}
                      />
                      {form.evidenceLinks.length > 1 && (
                        <button
                          type="button"
                          className="gcal-remove-link-btn"
                          title="Hapus tautan ini"
                          onClick={() => {
                            const next = form.evidenceLinks.filter(
                              (_, i) => i !== idx,
                            );
                            setForm({
                              ...form,
                              evidenceLinks: next.length ? next : [""],
                            });
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="wide gcal-color-picker">
                <span>Warna Label Blok</span>
                <div className="gcal-colors-row">
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      className={`gcal-color-dot ${form.color === c.hex ? "active" : ""}`}
                      style={{ backgroundColor: c.hex }}
                      onClick={() => setForm({ ...form, color: c.hex })}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-actions gcal-modal-actions">
              {editingActivity && (
                <button
                  type="button"
                  className="danger"
                  onClick={handleDelete}
                  disabled={saving}
                >
                  Hapus Aktivitas
                </button>
              )}
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <button type="button" onClick={() => setShowModal(false)} disabled={saving}>
                  Batal
                </button>
                <button
                  type="button"
                  className="primary"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? "Menyimpan..." : "Simpan Aktivitas"}
                </button>
              </div>
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
    </div>
  );
}
