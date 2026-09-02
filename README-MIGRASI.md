# Paket Migrasi e-Kinerja Versi 55

Paket ini merupakan snapshot source dari Versi 55 yang dipublikasikan pada 1 September 2026, ditambah schema MySQL untuk phpMyAdmin dan petunjuk migrasi Hostinger.

## Isi paket

- `application/` — source aplikasi Versi 55.
- `database/schema.sql` — schema MySQL 8/MariaDB 10.6+ beserta snapshot seluruh data existing Versi 55 saat paket diperbarui.
- `database/README-DATA-AKTUAL.md` — prosedur membawa data aktif.
- `config/.env.example` — contoh variabel lingkungan tanpa rahasia.
- `docs/Blueprint_Final_e-Kinerja.docx` — blueprint proyek.
- `docs/PETUNJUK-TEKNIS-HOSTINGER.md` — langkah teknis migrasi.
- `docs/CHECKLIST-UAT.md` — pengujian sebelum produksi.

## Catatan wajib

Catatan: isi database aktif tidak berada dalam source code. File `schema.sql` dalam paket ini sudah memuat snapshot seluruh data existing ketika diekspor pada 1 September 2026. Jika masih ada perubahan data setelah waktu tersebut, ekspor data aktual tetap harus dilakukan lagi saat migrasi final agar semua data terbaru ikut terbawa. Aplikasi juga masih memerlukan adaptasi runtime, database MySQL, dan login Google sebelum dipasang sebagai aplikasi produksi Hostinger.

Snapshot mencakup 64 baris dari 28 tabel, termasuk data demo, struktur organisasi, akun sistem, sesi aktif, rate limit, dan audit keamanan. Sesudah impor produksi, kosongkan tabel `active_user_sessions` dan wajibkan semua pengguna login ulang.

Source Versi 55 saat ini menggunakan runtime Sites/Cloudflare, database D1/SQLite, penyimpanan R2, dan identitas login Sites. Karena itu, mengimpor `schema.sql` saja belum membuat aplikasi langsung berjalan di Hostinger. Pengembang harus menyelesaikan adapter MySQL, penyimpanan lampiran, Google OAuth, session cookie, serta build Node.js terlebih dahulu.

Setelah mengekstrak ZIP, pastikan folder `application`, `database`, `config`, dan `docs` tersedia lengkap sebelum memulai migrasi.
