# Data aktual saat migrasi final

`schema.sql` membentuk struktur database sekaligus memasukkan snapshot seluruh data existing Versi 55 pada saat paket diperbarui.

Isi database aktif tidak berada dalam source code. Snapshot dalam `schema.sql` berisi data saat ekspor dibuat. Ekspor data aktual dilakukan kembali saat migrasi final jika ada perubahan setelah snapshot agar semua data terbaru ikut terbawa.

Urutan cutover data:

1. Hentikan sementara input pada situs aktif.
2. Ekspor database aktif setelah transaksi terakhir.
3. Konversi tipe data D1/SQLite ke MySQL, terutama tanggal, boolean, JSON, dan ID.
4. Impor `schema.sql` ke database kosong.
5. Jika tersedia ekspor yang lebih baru, gantikan bagian snapshot lama dengan data aktual terbaru.
6. Salin berkas lampiran R2/penyimpanan lama ke penyimpanan Hostinger.
7. Cocokkan jumlah pegawai, absensi, To-Do, RKT, PK, monev, sesi, dan audit.
8. Kosongkan `active_user_sessions` agar semua pengguna login ulang.
9. Uji akun per peran sebelum membuka situs baru.
