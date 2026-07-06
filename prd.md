# Product Requirements Document (PRD)
## GCR Materi Downloader (Chrome Extension)

**Versi Dokumen:** 1.0
**Tanggal:** 6 Juli 2026
**Pemilik Produk:** Jap
**Status:** Draft

---

## 1. Latar Belakang & Masalah

Mahasiswa/siswa yang menggunakan Google Classroom (GCR) sering kesulitan mengunduh materi kelas secara massal. Materi tersebar di berbagai topik/tugas dalam tab "Materi Kelas" (Classwork), dalam format campuran (Google Docs, Slides, Sheets, PDF upload, dsb). Proses manual (klik satu-satu, buka, download/export) memakan waktu, terutama menjelang ujian atau saat butuh backup seluruh isi kelas.

Tidak ada fitur bawaan Google Classroom untuk bulk-download seluruh materi kelas sekaligus.

## 2. Tujuan Produk

Membuat ekstensi Chrome yang memungkinkan pengguna men-scan halaman Classwork sebuah kelas GCR, menampilkan daftar seluruh materi yang terdeteksi, dan mengunduh materi yang dipilih (atau semua) secara otomatis dalam format yang sesuai.

## 3. Target Pengguna

- Mahasiswa/siswa pengguna Google Classroom yang ingin backup materi kelas.
- Pengguna casual, bukan developer — jadi UI harus sederhana dan tidak butuh setup teknis apa pun (no login OAuth pihak ketiga, cukup pakai sesi Google yang sudah login di browser).

## 4. Ruang Lingkup (Scope)

### 4.1 In-Scope (MVP)

| Fitur | Deskripsi |
|---|---|
| Deteksi materi otomatis | Scan tab "Materi Kelas" pada halaman kelas GCR yang sedang dibuka, ambil semua link Drive/Docs/Slides/Sheets/PDF. |
| Preview daftar file | Popup menampilkan checklist nama file + tipe file yang terdeteksi sebelum diunduh. |
| Pilih semua / pilih sebagian | User bisa toggle "select all" atau centang manual per file. |
| Download otomatis | Trigger download berurutan (dengan delay antar-file) via Chrome Downloads API. |
| Auto-export Google native file | File Docs/Slides/Sheets otomatis dikonversi ke PDF/PPTX/XLSX saat diunduh. |
| Notifikasi progres | Indikator jumlah file yang sudah/gedang/gagal diunduh. |

### 4.2 Out-of-Scope (Tidak di MVP)

- Download dari tab "Forum"/Stream (hanya fokus tab Classwork).
- Login/OAuth Google API resmi.
- Mengunduh dari kelas yang bukan milik akun yang sedang login.
- Mobile browser / Chrome versi mobile.
- Sinkronisasi otomatis / penjadwalan download berkala.
- Mengubah permission file di Drive (read-only, tidak menyentuh file aslinya).

## 5. User Stories

1. Sebagai mahasiswa, saya ingin membuka tab Classwork kelas saya lalu klik ikon ekstensi, agar saya melihat daftar semua materi yang bisa diunduh.
2. Sebagai mahasiswa, saya ingin mencentang file mana saja yang saya mau, agar saya tidak perlu download semua kalau tidak butuh.
3. Sebagai mahasiswa, saya ingin melihat progres unduhan, agar saya tahu kalau ada file yang gagal diunduh (misal karena permission private).
4. Sebagai mahasiswa, saya ingin file Google Docs/Slides/Sheets otomatis terkonversi ke format umum (PDF/PPTX/XLSX), agar bisa langsung dibuka tanpa akun Google.

## 6. Alur Pengguna (User Flow)

```
1. User membuka halaman kelas GCR → tab "Materi Kelas"
2. User klik ikon ekstensi di toolbar
3. Popup muncul → tombol "Scan Materi"
4. Content script scan DOM → kirim daftar file ke popup
5. Popup render checklist file (nama, tipe, ukuran jika tersedia)
6. User pilih file / klik "Pilih Semua"
7. User klik "Download"
8. Background script proses antrian download satu per satu (dengan delay)
9. Popup menampilkan status: berhasil / gagal per file
10. Selesai → notifikasi ringkasan (mis. "18/20 file berhasil diunduh")
```

## 7. Kebutuhan Fungsional

| ID | Requirement |
|---|---|
| F-01 | Ekstensi hanya aktif di halaman `classroom.google.com/c/*` |
| F-02 | Sistem harus mengekstrak seluruh `<a href>` yang mengarah ke domain `drive.google.com` atau `docs.google.com` dari dalam tab Materi Kelas |
| F-03 | Sistem harus mengidentifikasi tipe file (Docs/Slides/Sheets/PDF/lainnya) berdasarkan pola URL |
| F-04 | Untuk file Google native (Docs/Slides/Sheets), sistem otomatis mengubah URL menjadi endpoint export sesuai format target |
| F-05 | Sistem harus menyediakan UI checklist sebelum eksekusi download |
| F-06 | Sistem harus memberi delay antar-download untuk menghindari pemblokiran |
| F-07 | Sistem harus menangani dan melaporkan file yang gagal diunduh (403/permission error) tanpa menghentikan seluruh antrian |
| F-08 | Nama file hasil unduhan mengikuti judul asli materi (sanitized dari karakter ilegal untuk nama file) |

## 8. Kebutuhan Non-Fungsional

- **Performa**: Scan DOM selesai dalam < 2 detik untuk kelas dengan ~50 materi.
- **Keandalan**: Selector DOM harus berbasis atribut/URL pattern yang stabil, bukan class name yang di-obfuscate Google (karena class name berubah tiap update GCR).
- **Privasi**: Tidak ada data yang dikirim ke server pihak ketiga; seluruh proses berjalan lokal di browser pengguna.
- **Kompatibilitas**: Manifest V3, Chrome versi terbaru (dan browser berbasis Chromium seperti Edge/Brave sebagai bonus).
- **Keamanan**: Permission ekstensi dibatasi minimal (`activeTab`, `downloads`, `scripting`, `storage`, host permission hanya ke `classroom.google.com`).

## 9. Batasan & Risiko

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Google mengubah struktur DOM GCR | Selector scraping rusak, fitur berhenti bekerja | Gunakan selector berbasis pola URL (stabil), bukan class name; siapkan mekanisme update cepat |
| File dengan restricted permission | Download gagal tanpa notifikasi jelas | Deteksi response error, tampilkan status "Gagal - tidak ada akses" per file |
| Rate-limit/flagging dari Google saat banyak request berurutan | Sebagian download gagal/lambat | Delay antar-download (300–500ms), batasi jumlah concurrent request |
| Materi berupa Link eksternal (bukan Drive) | Tidak bisa "diunduh", hanya berupa tautan | Tampilkan sebagai kategori terpisah, beri opsi "buka link" saja |
| Review Chrome Web Store | Ekstensi ditolak/perlu revisi karena permission dianggap luas | Deskripsikan fungsi dengan jelas di listing, minimalkan permission yang diminta |

## 10. Metrik Keberhasilan (Success Metrics)

- Tingkat keberhasilan scraping: > 95% materi ter-scan dan terlist dengan benar.
- Tingkat keberhasilan download: > 90% file dari yang dipilih berhasil diunduh tanpa error.
- Waktu rata-rata dari klik "Scan" sampai daftar tampil: < 3 detik.
- Rating Chrome Web Store: target ≥ 4.0 dalam 3 bulan pertama publish.

## 11. Rencana Rilis

| Fase | Cakupan |
|---|---|
| MVP (v1.0) | Scan + preview + download manual per kelas, single tab |
| v1.1 | Support kategori "Link eksternal" & YouTube video (buka/simpan link) |
| v1.2 | Opsi rename otomatis dengan format `[Topik]_[NamaFile]` untuk rapi saat di-zip |
| v1.3 (opsional) | Bundling hasil download jadi satu ZIP di sisi client (pakai JSZip) |
| v2.0 (opsional) | Multi-kelas sekaligus (loop otomatis ke semua kelas yang diikuti user) |

## 12. Pertanyaan Terbuka

- Apakah perlu dukungan untuk mengunduh lampiran dari Stream/Forum, bukan hanya Classwork?
- Apakah perlu opsi export format custom untuk Google Docs (mis. selain PDF, ada opsi .docx)?
- Apakah target rilis publik langsung ke Chrome Web Store atau internal testing dulu (mis. dibagikan ke teman kampus) sebelum publish resmi?