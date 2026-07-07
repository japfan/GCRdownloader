# 🎓 GCR Materi Downloader

Ekstensi Chrome untuk mengunduh materi kelas dari **Google Classroom** secara massal (bulk download).

![Version](https://img.shields.io/badge/version-1.0-blue)
![Manifest](https://img.shields.io/badge/manifest-v3-green)

## ✨ Fitur

- 🔍 **Deteksi otomatis** — Scan semua file/lampiran di halaman *Classwork* Google Classroom
- 📂 **Multi-format** — Dokumen, Slides, Sheets, Forms, PDF, gambar, video, ZIP, dan lainnya
- ✅ **Pilih & unduh massal** — Centang file yang ingin diunduh, klik sekali
- 📊 **Progress bar** — Pantau proses unduhan real-time
- 🇮🇩 **UI Bahasa Indonesia** — Antarmuka full Bahasa Indonesia
- 🔒 **Privasi terjaga** — Semua proses berjalan lokal di browser, tidak ada data dikirim ke server

## 🚀 Instalasi (Manual)

> Ekstensi belum dipublikasikan di Chrome Web Store. Ikuti langkah berikut untuk install secara manual:

1. **Download atau clone repositori ini:**
   ```bash
   git clone https://github.com/japfan/GCRdownloader.git
   ```

2. **Buka Chrome Extensions:**
   - Buka `chrome://extensions/` di Chrome
   - Aktifkan **Developer mode** (toggle di pojok kanan atas)

3. **Load unpacked:**
   - Klik **Load unpacked**
   - Pilih folder `GCRdownloader`

4. **Selesai!** Icon ekstensi akan muncul di toolbar Chrome. Pin untuk akses cepat.

## 📖 Cara Pakai

1. Buka [Google Classroom](https://classroom.google.com)
2. Masuk ke salah satu **kelas**
3. Klik tab **Materi Kelas** (Classwork)
4. Klik icon ekstensi ![icon](icons/icon-16.png) di toolbar Chrome
5. Klik tombol **Scan Materi**
6. Centang file yang ingin diunduh (atau biarkan *Pilih Semua*)
7. Klik **Download Terpilih**
8. File tersimpan di folder `GCR_Materi/` di direktori download Chrome

## 📁 Struktur File

```
GCRdownloader/
├── manifest.json       # Konfigurasi ekstensi (Manifest V3)
├── background.js       # Service worker — handle download queue
├── content.js          # Content script — scraping halaman Classroom
├── popup.html          # UI popup ekstensi (Tailwind CSS)
├── popup.js            # Logic popup — scan, pilih, unduh
├── popup.css           # Styling tambahan
├── icons/              # Icon ekstensi (16px, 48px, 128px)
└── README.md           # File ini
```

## 🎯 Format File yang Didukung

| Tipe | Google Format | Output |
|------|--------------|--------|
| 📄 Dokumen | `docs.google.com/document` | PDF |
| 📊 Presentasi | `docs.google.com/presentation` | PDF |
| 📈 Spreadsheet | `docs.google.com/spreadsheets` | PDF |
| 📋 Form | `docs.google.com/forms` | - * |
| 📁 Drive File | `drive.google.com/file/...` | Original |
| 🖼️ Gambar | `.jpg` `.png` `.gif` `.webp` | Original |
| 🎥 Video | `.mp4` `.mkv` `.webm` | Original |
| 📦 Arsip | `.zip` `.rar` `.7z` | Original |

*\* Google Forms dan Drive Folder tidak bisa diexport via URL langsung. File akan muncul tapi unduhan mungkin gagal.*

## ⚙️ Permission

| Permission | Kenapa Dibutuhkan |
|-----------|-------------------|
| `activeTab` | Mengakses tab Classroom yang sedang aktif |
| `downloads` | Menyimpan file ke komputer |
| `scripting` | Menyuntikkan script untuk mendeteksi materi di halaman |
| `storage` | Menyimpan konfigurasi (opsional, untuk fitur mendatang) |
| Host: `classroom.google.com` | Hanya berjalan di Google Classroom |
| Host: `drive.google.com` | Deteksi dan unduh file Drive |
| Host: `docs.google.com` | Deteksi dan export Docs/Sheets/Slides |

## ❓ Troubleshooting

### "Gagal mendeteksi materi"
- Pastikan Anda di tab **Materi Kelas** (Classwork), bukan Stream/Forum
- Scroll halaman sampai semua materi termuat (Google Classroom pakai lazy-load)
- Coba **refresh halaman**, lalu klik Scan lagi
- Debug info akan muncul di popup — periksa apakah link Google Drive/Docs terdeteksi

### "Gagal men-scan halaman"
- Pastikan Anda **sudah masuk ke salah satu kelas** (bukan halaman daftar kelas)
- URL harus mengandung `classroom.google.com/c/...` atau `classroom.google.com/w/...`

### Download gagal untuk file tertentu
- Google Forms tidak bisa diunduh via URL export — buka manual
- File yang disetel *View Only* mungkin butuh akses tambahan
- Coba buka file di tab baru, lalu klik Scan ulang

---

© 2026 — Dibuat untuk memudahkan mahasiswa Indonesia
