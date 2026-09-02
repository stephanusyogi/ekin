# Petunjuk Teknis Hostinger — e-Kinerja Versi 55

## 1. Siapkan Hostinger

1. Buat subdomain khusus, misalnya `ekinerja.domainanda.id`, lalu aktifkan SSL.
2. Buat database MySQL dan user database khusus e-Kinerja.
3. Aktifkan aplikasi Node.js 22.x dan SSH.
4. Jangan memakai database situs lain untuk e-Kinerja.

## 2. Impor schema

1. Masuk ke phpMyAdmin dan pilih database e-Kinerja yang masih kosong.
2. Pilih **Import** lalu unggah `database/schema.sql`.
3. Format: SQL; character set: `utf8mb4`.
4. Pastikan seluruh 28 tabel terbentuk dan tidak ada pesan gagal.

Schema ini memasukkan snapshot seluruh data existing Versi 55, termasuk akun Super User dan data demo. Sesudah impor, kosongkan `active_user_sessions` agar sesi lama tidak dibawa ke lingkungan baru.

## 3. Adaptasi aplikasi yang wajib dikerjakan

1. Ganti driver Drizzle D1/SQLite menjadi driver MySQL yang kompatibel dengan Node.js.
2. Sesuaikan semua query dan transaksi dengan schema MySQL.
3. Ganti penyimpanan R2 untuk surat pernyataan dengan folder privat atau object storage.
4. Ganti header identitas Sites dengan Google OAuth.
5. Batasi login hanya email pegawai aktif dan akun sistem aktif.
6. Pertahankan aturan satu pengguna satu sesi aktif.
7. Gunakan cookie `HttpOnly`, `Secure`, dan `SameSite=Lax/Strict`.
8. Jalankan migration/seed produksi tanpa menjalankan reset demo otomatis.
9. Pastikan seluruh secret hanya berada di environment Hostinger.

## 4. Google OAuth

Daftarkan callback sesuai implementasi, misalnya:

`https://ekinerja.domainanda.id/api/auth/callback/google`

Isi `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET`, dan `APP_URL` dari pengaturan environment. Jangan unggah `.env` produksi ke folder publik atau Git.

## 5. Build dan start

Setelah adaptasi Node/MySQL selesai:

```bash
npm ci
npm run build
npm run start
```

Gunakan variabel `PORT` yang diberikan Hostinger. Jangan mengunci port sendiri.

## 6. Migrasi data aktual

Ikuti `database/README-DATA-AKTUAL.md`. Lakukan cutover setelah source yang sudah diadaptasi lulus pengujian. Simpan backup sebelum setiap impor.

## 7. Keamanan produksi

- SSL wajib dan redirect HTTP ke HTTPS.
- Database tidak boleh dapat diakses publik.
- Batasi ukuran dan tipe upload; simpan di luar public web root.
- Terapkan rate limit login dan mutasi.
- Log tindakan CRUD, persetujuan, absensi, serta perubahan hak akses.
- Backup database harian dan uji proses restore.
- Perbarui dependensi dan lakukan pemindaian kerentanan sebelum go-live.

## 8. Cutover

1. Aktifkan mode pemeliharaan situs lama.
2. Ekspor data aktif dan lampiran terakhir.
3. Impor serta verifikasi data di Hostinger.
4. Uji Super User, Admin, Editor, User, Viewer, Operator Absensi, dan Operator SAKIP.
5. Uji Absensi, To-Do, Agenda, RKT/PK/Monev, cetak, persetujuan, dan pembatasan cakupan.
6. Alihkan domain setelah hasil UAT disetujui.
7. Pertahankan backup dan situs lama mode baca selama masa stabilisasi.
