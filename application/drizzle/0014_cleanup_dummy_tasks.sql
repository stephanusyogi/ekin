-- Hapus hanya tiga judul simulasi awal; data To-Do aktual lainnya dipertahankan.
DELETE FROM `tasks`
WHERE `title` IN (
  'Finalisasi laporan kegiatan bulanan',
  'Verifikasi data perjalanan dinas',
  'Arsip digital surat masuk'
);
