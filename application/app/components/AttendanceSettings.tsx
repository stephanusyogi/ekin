"use client";
import { useEffect, useState } from "react";
export default function AttendanceSettings() {
  const [form, setForm] = useState<any>({
    mondayThursdayStart: "07:30",
    mondayThursdayEnd: "16:00",
    fridayStart: "07:30",
    fridayEnd: "16:30",
    morningCutoff: "08:30",
    dailyCloseEnabled: false,
    dailyCloseTime: "18:00",
    checkInWindowEnabled: false,
    checkInOpenTime: "05:00",
    checkInCloseTime: "08:30",
    checkOutWindowEnabled: false,
    mondayThursdayCheckOutOpen: "16:00",
    fridayCheckOutOpen: "16:30",
    checkOutCloseTime: "23:59",
    printHeader: "",
    printPlace: "",
  });
  const [holidays, setHolidays] = useState<any[]>([]);
  const [holiday, setHoliday] = useState({
    date: "",
    title: "",
    description: "",
  });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const notify = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 2500);
  };
  const load = async () => {
    try {
      const [s, h] = await Promise.all([
        fetch("/api/admin/attendance-settings"),
        fetch("/api/admin/holidays"),
      ]);
      const sd = await s.json(),
        hd = await h.json();
      if (!s.ok) throw new Error(sd.error);
      setForm(sd.settings);
      if (h.ok) setHolidays(hd.holidays);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Setting belum dapat dimuat");
    }
  };
  useEffect(() => {
    load();
  }, []);
  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch("/api/admin/attendance-settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setForm(d.settings);
      notify("Setting Absensi berhasil disimpan");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Setting belum tersimpan");
    } finally {
      setSaving(false);
    }
  };
  const addHoliday = async () => {
    if (!holiday.date || !holiday.title.trim()) {
      notify("Tanggal dan nama hari libur wajib diisi");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch("/api/admin/holidays", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(holiday),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setHoliday({ date: "", title: "", description: "" });
      notify("Hari libur ditambahkan dan diumumkan");
      await load();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Hari libur belum tersimpan");
    } finally {
      setSaving(false);
    }
  };
  const remove = async (id: number) => {
    const r = await fetch(`/api/admin/holidays?id=${id}`, { method: "DELETE" });
    if (r.ok) {
      notify("Hari libur dihapus");
      await load();
    } else notify("Hari libur belum dapat dihapus");
  };
  return (
    <section className="rule-page">
      <div className="page-title">
        <div>
          <p>KHUSUS SUPER ADMIN</p>
          <h1>Setting Absensi</h1>
          <span>Pusat seluruh pengaturan perilaku sistem absensi.</span>
        </div>
        <button className="primary" onClick={save} disabled={saving}>
          {saving ? "Menyimpan..." : "Simpan Setting"}
        </button>
      </div>
      <div className="settings-sections">
        <article className="rule-card">
          <div className="rule-card-head">
            <b>Jadwal Kerja</b>
            <span>Sabtu–Minggu otomatis libur</span>
          </div>
          <div className="rule-fields">
            <label>
              Senin–Kamis · Masuk
              <input
                type="time"
                value={form.mondayThursdayStart}
                onChange={(e) =>
                  setForm({ ...form, mondayThursdayStart: e.target.value })
                }
              />
            </label>
            <label>
              Senin–Kamis · Pulang
              <input
                type="time"
                value={form.mondayThursdayEnd}
                onChange={(e) =>
                  setForm({ ...form, mondayThursdayEnd: e.target.value })
                }
              />
            </label>
            <label>
              Jumat · Masuk
              <input
                type="time"
                value={form.fridayStart}
                onChange={(e) =>
                  setForm({ ...form, fridayStart: e.target.value })
                }
              />
            </label>
            <label>
              Jumat · Pulang
              <input
                type="time"
                value={form.fridayEnd}
                onChange={(e) =>
                  setForm({ ...form, fridayEnd: e.target.value })
                }
              />
            </label>
          </div>
        </article>
        <article className="rule-card">
          <div className="rule-card-head">
            <b>Keterlambatan</b>
            <span>Penggantian tetap 1:1</span>
          </div>
          <div className="rule-fields">
            <label>
              Batas masuk terakhir
              <input
                type="time"
                value={form.morningCutoff}
                onChange={(e) =>
                  setForm({ ...form, morningCutoff: e.target.value })
                }
              />
            </label>
            <div className="fixed-rule">
              <b>Setelah 07.30</b>
              <span>
                Mengganti sejumlah menit keterlambatan setelah jam pulang.
              </span>
            </div>
            <div className="rule-warning">
              <b>Setelah {form.morningCutoff}</b>
              <span>Absen tercatat dengan status Tidak Masuk Kerja.</span>
            </div>
          </div>
        </article>
        <article className="rule-card">
          <div className="rule-card-head">
            <b>Penutupan Harian</b>
            <span>Pelaksanaan otomatis setiap hari</span>
          </div>
          <div className="rule-fields">
            <label className="switch-line">
              <input
                type="checkbox"
                checked={Boolean(form.dailyCloseEnabled)}
                onChange={(e) =>
                  setForm({ ...form, dailyCloseEnabled: e.target.checked })
                }
              />{" "}
              Aktifkan penutupan
            </label>
            <label>
              Jam penutupan
              <input
                type="time"
                value={form.dailyCloseTime}
                onChange={(e) =>
                  setForm({ ...form, dailyCloseTime: e.target.value })
                }
              />
            </label>
            <div className="rule-example">
              <b>Pembukaan terlambat</b>
              <span>
                Setelah disetujui, akses otomatis terbuka selama satu jam lalu
                terkunci kembali.
              </span>
            </div>
          </div>
        </article>
        <article className="rule-card">
          <div className="rule-card-head">
            <b>Jam Absen Masuk</b>
            <span>Opsional · membatasi waktu tombol Masuk</span>
          </div>
          <div className="rule-fields">
            <label className="switch-line">
              <input
                type="checkbox"
                checked={Boolean(form.checkInWindowEnabled)}
                onChange={(e) =>
                  setForm({ ...form, checkInWindowEnabled: e.target.checked })
                }
              />{" "}
              Aktifkan aturan jam masuk
            </label>
            <div className="window-state">
              <b>
                {form.checkInWindowEnabled ? "Aturan aktif" : "Aturan nonaktif"}
              </b>
              <span>
                {form.checkInWindowEnabled
                  ? `Hanya pukul ${form.checkInOpenTime}–${form.checkInCloseTime}`
                  : "Tersedia tanpa pembatasan jam khusus."}
              </span>
            </div>
            <label>
              Mulai dibuka
              <input
                type="time"
                disabled={!form.checkInWindowEnabled}
                value={form.checkInOpenTime}
                onChange={(e) =>
                  setForm({ ...form, checkInOpenTime: e.target.value })
                }
              />
            </label>
            <label>
              Ditutup
              <input
                type="time"
                disabled={!form.checkInWindowEnabled}
                value={form.checkInCloseTime}
                onChange={(e) =>
                  setForm({ ...form, checkInCloseTime: e.target.value })
                }
              />
            </label>
          </div>
        </article>
        <article className="rule-card">
          <div className="rule-card-head">
            <b>Jam Absen Pulang</b>
            <span>Opsional · mengikuti hari kerja</span>
          </div>
          <div className="rule-fields">
            <label className="switch-line">
              <input
                type="checkbox"
                checked={Boolean(form.checkOutWindowEnabled)}
                onChange={(e) =>
                  setForm({ ...form, checkOutWindowEnabled: e.target.checked })
                }
              />{" "}
              Aktifkan aturan jam pulang
            </label>
            <div className="window-state">
              <b>
                {form.checkOutWindowEnabled
                  ? "Aturan aktif"
                  : "Aturan nonaktif"}
              </b>
              <span>
                {form.checkOutWindowEnabled
                  ? "Hanya aktif dalam rentang yang ditentukan."
                  : "Tersedia tanpa pembatasan jam khusus."}
              </span>
            </div>
            <label>
              Senin–Kamis dibuka
              <input
                type="time"
                disabled={!form.checkOutWindowEnabled}
                value={form.mondayThursdayCheckOutOpen}
                onChange={(e) =>
                  setForm({
                    ...form,
                    mondayThursdayCheckOutOpen: e.target.value,
                  })
                }
              />
            </label>
            <label>
              Jumat dibuka
              <input
                type="time"
                disabled={!form.checkOutWindowEnabled}
                value={form.fridayCheckOutOpen}
                onChange={(e) =>
                  setForm({ ...form, fridayCheckOutOpen: e.target.value })
                }
              />
            </label>
            <label>
              Ditutup setiap hari
              <input
                type="time"
                disabled={!form.checkOutWindowEnabled}
                value={form.checkOutCloseTime}
                onChange={(e) =>
                  setForm({ ...form, checkOutCloseTime: e.target.value })
                }
              />
            </label>
            <div className="rule-example">
              <b>Pembukaan terlambat</b>
              <span>
                Persetujuan atasan selama satu jam dapat melewati pembatasan
                jadwal.
              </span>
            </div>
          </div>
        </article>
        <article className="rule-card">
          <div className="rule-card-head">
            <b>Periode Rekap</b>
            <span>Diterapkan otomatis</span>
          </div>
          <div className="fixed-summary">
            <b>Tanggal 21–20</b>
            <span>
              Periode dimulai tanggal 21 bulan sebelumnya dan berakhir tanggal
              20 bulan berjalan.
            </span>
          </div>
        </article>
        <article className="rule-card">
          <div className="rule-card-head">
            <b>Format Cetak Absensi</b>
            <span>Digunakan pada seluruh laporan absensi</span>
          </div>
          <div className="rule-fields">
            <label>
              Header laporan
              <textarea
                rows={5}
                maxLength={500}
                value={form.printHeader || ""}
                onChange={(e) =>
                  setForm({ ...form, printHeader: e.target.value })
                }
                placeholder={
                  "Contoh:\nNAMA INSTANSI\nAlamat dan informasi instansi"
                }
              />
              <small>
                {(form.printHeader || "").length}/500 karakter · Enter akan
                membuat baris baru
              </small>
            </label>
            <label>
              Tempat cetak
              <input
                maxLength={100}
                value={form.printPlace || ""}
                onChange={(e) =>
                  setForm({ ...form, printPlace: e.target.value })
                }
                placeholder="Contoh: Jakarta"
              />
              <small>
                Akan ditampilkan bersama tanggal cetak di atas tanda tangan.
              </small>
            </label>
            <div className="print-setting-preview">
              <b>Pratinjau</b>
              <strong>{form.printHeader || "Header belum diisi"}</strong>
              <span>
                {form.printPlace || "Tempat Cetak"},{" "}
                {new Date().toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>
        </article>
      </div>
      <section className="holiday-manager">
        <div className="rule-card-head">
          <b>Hari Libur Tambahan</b>
          <span>
            Otomatis menjadi pengumuman dan dikeluarkan dari rekap reguler
          </span>
        </div>
        <div className="holiday-form">
          <label>
            Tanggal
            <input
              type="date"
              value={holiday.date}
              onChange={(e) => setHoliday({ ...holiday, date: e.target.value })}
            />
          </label>
          <label>
            Nama Hari Libur
            <input
              value={holiday.title}
              onChange={(e) =>
                setHoliday({ ...holiday, title: e.target.value })
              }
            />
          </label>
          <label>
            Keterangan
            <input
              value={holiday.description}
              onChange={(e) =>
                setHoliday({ ...holiday, description: e.target.value })
              }
            />
          </label>
          <button className="primary" onClick={addHoliday} disabled={saving}>
            Tambah
          </button>
        </div>
        <div className="holiday-list">
          {holidays.length ? (
            holidays.map((h) => (
              <article key={h.id}>
                <div className="holiday-date">
                  <b>{h.holidayDate.slice(8, 10)}</b>
                  <span>{h.holidayDate.slice(5, 7)}</span>
                </div>
                <div>
                  <b>{h.title}</b>
                  <span>{h.description || "Tanpa keterangan"}</span>
                </div>
                <button onClick={() => remove(h.id)}>Hapus</button>
              </article>
            ))
          ) : (
            <div className="empty-state">Belum ada hari libur tambahan.</div>
          )}
        </div>
      </section>
      {toast && (
        <div className="toast">
          <span>✓</span>
          {toast}
        </div>
      )}
    </section>
  );
}
