# 🎓 GCR Materi Downloader

Ekstensi Chrome untuk mengunduh materi kelas secara massal dari **Google Classroom** dan **SPADA UNS**.

![Version](https://img.shields.io/badge/version-1.1-blue)
![Manifest](https://img.shields.io/badge/manifest-v3-green)

## ✨ Fitur

- 🔍 **Multi-platform** — Google Classroom + SPADA UNS / Moodle
- 📂 **Multi-format** — PDF, PPTX, DOCX, XLSX, CSV, gambar, video, ZIP, dan lainnya
- ✅ **Pilih & unduh massal** — Centang file yang ingin diunduh, klik sekali
- 📊 **Progress bar** — Pantau proses unduhan real-time
- 🌙 **Dark mode** — Toggle light/dark, preferensi disimpan otomatis
- 🇮🇩 **UI Bahasa Indonesia** — Antarmuka full Bahasa Indonesia
- 🔒 **Privasi terjaga** — Data aman karena semua proses berjalan lokal di browser

## 🚀 Instalasi (Manual)

> Ekstensi belum dipublikasikan di Chrome Web Store. Ikuti langkah berikut untuk install secara manual:

1. **Download ekstensi:**
   - **[⬇ Download ZIP langsung](https://github.com/japfan/GCRdownloader/archive/refs/heads/main.zip)**
   - Atau clone: `git clone https://github.com/japfan/GCRdownloader.git`
   - Ekstrak ZIP ke folder manapun

2. **Buka Chrome Extensions:**
   - Buka `chrome://extensions/` di Chrome
   - Aktifkan **Developer mode** (toggle di pojok kanan atas)

3. **Load unpacked:**
   - Klik **Load unpacked**
   - Pilih folder `GCRdownloader`

4. **Selesai!** Icon ekstensi akan muncul di toolbar Chrome. Pin untuk akses cepat.

## 📖 Cara Pakai

### Google Classroom
1. Buka [Google Classroom](https://classroom.google.com)
2. Masuk ke salah satu **kelas**
3. Klik tab **Materi Kelas** (Classwork)
4. Klik icon ekstensi → **Scan Materi**
5. Centang file → **Download Terpilih**
6. File tersimpan di folder `GCR_Materi/`

### SPADA / Moodle
1. Buka SPADA UNS (`spada.uns.ac.id`) atau Moodle instansi lain
2. Masuk ke halaman **course** (`course/view.php?id=...`)
3. Klik icon ekstensi → **Scan Materi**
4. Centang file → **Download Terpilih**
5. File tersimpan di folder `GCR_Materi/`

## 📁 Struktur File

```
GCRdownloader/
├── manifest.json       # Konfigurasi ekstensi (Manifest V3)
├── background.js       # Service worker — download queue + auth cookies
├── content.js          # Content script — scraper GCR + Moodle
├── popup.html          # UI popup (Tailwind CSS)
├── popup.js            # Logic popup — scan, pilih, unduh, dark mode
├── popup.css           # Styling + dark mode
├── diagnose.js         # Script diagnostik DOM (untuk debugging SPADA)
├── icons/              # Icon ekstensi + logo
└── README.md           # File ini
```

## 🎯 Platform yang Didukung

| Platform | URL Pattern | Status |
|----------|------------|--------|
| Google Classroom | `classroom.google.com` | ✅ File + Drive links |
| SPADA UNS | `spada.uns.ac.id` | ✅ pluginfile + mod/resource |
| Moodle (generik) | domain dengan `/course/view.php` | ✅ Auto-detect |

## 🎯 Format File yang Didukung

| Tipe Ekstensi | Google Format | SPADA/Moodle |
|--------------|--------------|--------------|
| 📄 PDF | Docs export → PDF | Download langsung |
| 📊 PPTX | Slides export → PDF | Download langsung |
| 📈 XLSX / CSV | Sheets export → PDF | Download langsung |
| 📝 DOCX | - | Download langsung |
| 🖼️ Gambar | Drive file | Download langsung |
| 🎥 Video | Drive file | Download langsung |
| 📦 ZIP/RAR | Drive file | Download langsung |
| 🔗 URL eksternal | - | Buka di tab baru |

*\* Google Forms dan Drive Folder tidak bisa diunduh via URL langsung.*

## ⚙️ Permission

| Permission | Kenapa Dibutuhkan |
|-----------|-------------------|
| `activeTab` | Mengakses tab yang sedang aktif |
| `cookies` | Membaca cookie sesi untuk download dari SPADA/Moodle |
| `downloads` | Menyimpan file ke komputer |
| `scripting` | Menyuntikkan script untuk mendeteksi materi |
| `storage` | Menyimpan preferensi dark mode |
| Host: `classroom.google.com` | Google Classroom |
| Host: `drive.google.com` + `docs.google.com` | Google Drive & Docs |
| Host: `spada.uns.ac.id` | SPADA UNS |

## ❓ Troubleshooting

### "Gagal mendeteksi materi" (Google Classroom)
- Pastikan Anda di tab **Materi Kelas** (Classwork), bukan Stream
- Scroll halaman sampai semua materi termuat (Google Classroom pakai lazy-load)
- Refresh halaman, lalu klik Scan lagi

### "Gagal mendeteksi materi" (SPADA/Moodle)
- Pastikan Anda di halaman **course** (`course/view.php?id=...`), bukan dashboard
- Jalankan `diagnose.js` di Console DevTools untuk melihat struktur halaman
- Paste hasil diagnostik ke developer untuk penyesuaian

### Download gagal (SPADA)
- Ekstensi perlu permission `cookies` — pastikan sudah di-allow saat install
- File `mod/resource` akan di-resolve ke `pluginfile.php` sebelum download
- Coba klik file langsung di browser — kalau bisa, ekstensi juga harusnya bisa

### File tanpa ekstensi
- File dari `mod/resource` akan otomatis diberi ekstensi dari URL hasil redirect
- Kalau masih tanpa ekstensi, tambahkan manual atau laporkan ke developer

---

© 2026 — Dibuat untuk memudahkan mahasiswa Indonesia
