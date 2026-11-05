# Panduan Sinkron Moka POS → Dashboard Commercial

Sinkron ini menggantikan upload manual export Moka (Sales Type, Item Sales, Transaksi)
di menu **Upload Data**. Setiap pagi GitHub menarik data dari API Moka, mencocokkannya
dengan laporan Sales Summary Moka, lalu mengisi tabel Supabase yang sama dengan yang
dibaca dashboard.

```
Moka POS (API)  ──►  GitHub Actions (setiap hari 04:37 WITA)  ──►  Supabase  ──►  Dashboard Commercial
                     token disimpan di GitHub Secrets                         (GitHub Pages / Netlify)
```

> **Penting — keamanan token.** Repo `commercial` bersifat publik dan halaman dashboard
> bisa dibaca siapa pun. Token Moka (punya akses transaksi & data pelanggan) **tidak boleh**
> ditulis di `index.html` atau file mana pun di repo. Simpan hanya di GitHub Secrets.

---

## 1. Pasang file ke repo

Tambahkan dua file ini ke repo `yudhisulistyo77-ui/commercial` (branch `main`):

| File | Isi |
|---|---|
| `moka-sync/moka_sync.py` | skrip penarik data (Python, tanpa library tambahan) |
| `.github/workflows/moka-sync.yml` | jadwal otomatis + tombol jalankan manual |

Lewat browser: buka repo → **Add file → Create new file** → ketik nama lengkap
`.github/workflows/moka-sync.yml` (folder dibuat otomatis) → tempel isinya → **Commit changes**.
Ulangi untuk `moka-sync/moka_sync.py`.

## 2. Isi GitHub Secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Nama secret | Isi |
|---|---|
| `MOKA_ACCESS_TOKEN` | nilai `access_token` dari Moka |
| `SUPABASE_URL` | `https://qrabkayuwglmlaouliwn.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Supabase → Project Settings → API Keys → **secret key** (`sb_secret_…`) atau `service_role` |

Kunci *secret* Supabase hanya untuk server (di sini: GitHub Actions). Jangan dimasukkan ke
menu Pengaturan dashboard; dashboard tetap memakai *publishable/anon key* seperti biasa.

## 3. Cocokkan nama toko

Skrip mencari toko dengan aturan yang sama seperti Upload Data: nama outlet Moka harus
sama dengan **nama toko** atau **alias** di Pengaturan dashboard. Nama outlet di Moka saat ini:

MAMU MAKASSAR · MAMU BTP · MAMU GOWA · MAMU PALOPO · MAMU KENDARI ·
TIGALAPANKAOS MAKASSAR · TIGALAPANKAOS MANADO · TIGALAPANKAOS PALU · TIGALAPANKAOS POLMAN ·
TIGALAPANKAOS SAMARINDA · TIGALAPANKAOS TORAJA · TIGALAPANKAOS BONE ·
DC TIGALAPAN · GUDANG DEFECT

Outlet yang tidak terdaftar (mis. DC TIGALAPAN, GUDANG DEFECT) dilewati dan dicatat di log.
Tambahkan alias kalau ingin ikut masuk dashboard.

## 4. Uji coba, lalu jalankan

1. Repo → **Actions → Sinkron Moka POS → Run workflow** → centang **Uji coba** → Run.
   Tidak ada yang ditulis ke database; ringkasan per toko muncul di halaman hasil run.
2. Kalau semua toko berstatus OK, jalankan lagi tanpa centang Uji coba.
3. **Isi data bulan-bulan lalu (sekali saja):** isi kolom *Bulan* dengan rentang, mis.
   `2026-01..2026-10`. Data bulan itu di database diganti dengan data Moka.
   Toko besar butuh ±8–10 menit per bulan, jadi rentang panjang bisa makan 1–3 jam;
   bisa dipecah per kuartal.

Setelah itu jadwal harian berjalan sendiri. Klik **Muat ulang** di dashboard untuk melihat
data terbaru.

## 5. Yang ditulis setiap sinkron

| Tabel | Sumber Moka | Keterangan |
|---|---|---|
| `sales_type_raw` | transaksi per baris item | Total Collected per Sales Type; refund mengurangi nilai (pakai nilai refund resmi, refund ganda di feed Moka diabaikan), baris komponen bundling tidak dihitung ganda |
| `item_sales` | laporan Item Sales | Item Sold, Item Refunded, Net Sales, SKU, kategori |
| `transaksi` | Sales Summary | jumlah transaksi & net sales (dibaca dashboard sebagai input transaksi) |
| `ingest_log` | — | catatan per toko-bulan, `file_name` = `MOKA API <tanggal jam>` |
| `sales_actual` | — | dihitung ulang lewat `rebuild_sales_actual` |

**Cakupan:** bulan berjalan sampai **kemarin** (hari yang sudah tutup). Pada tanggal 1–3,
bulan sebelumnya ikut disinkron ulang untuk menangkap transaksi offline/refund yang telat masuk.
Batas hari mengikuti zona waktu akun Moka (WIB), sama dengan export Back Office.

**Pengaman:** total Sales Type dan Item Sales tiap toko-bulan dicocokkan dengan Sales Summary
Moka (toleransi Rp10). Kalau tidak cocok, data lama **tidak disentuh** dan status ERROR
muncul di log dan ringkasan run.

**Sales Type baru** yang belum ada di mapping tetap masuk dan tampil sebagai "belum termapping",
sama seperti hasil upload. Atur di **Upload Data → Mapping**.

**Catatan `trx_count`:** diisi jumlah transaksi penjualan yang memuat Sales Type tersebut.
Bandingkan dengan kolom Count di export Sales Type Moka untuk satu toko-bulan sebelum dipakai
sebagai dasar AOV per program.

## 6. Masa berlaku token

Token yang dipakai dibuat 5 Nov 2026 dan berlaku **sampai 4 Mei 2027**. Mulai 30 hari sebelum
itu, run akan menampilkan peringatan. Cara memperbarui: buat token baru dari aplikasi Moka
Developer, ganti secret `MOKA_ACCESS_TOKEN`, dan ubah `MOKA_TOKEN_EXPIRES` di
`.github/workflows/moka-sync.yml`.

## 7. Kalau ada masalah

| Gejala | Penyebab & solusi |
|---|---|
| `Token Moka ditolak (401)` | token kedaluwarsa/dicabut → perbarui secret `MOKA_ACCESS_TOKEN` |
| `SUPABASE_KEY belum diisi` | secret `SUPABASE_SERVICE_KEY` belum dibuat |
| `HTTP 401/403` dari Supabase | kunci salah, atau memakai publishable key yang tidak punya izin tulis |
| `… belum ada di daftar toko/alias` | tambahkan alias nama outlet Moka di Pengaturan dashboard |
| `Sales Type … != Sales Summary …` | ada pola transaksi baru di Moka; data lama aman, laporkan untuk diperbaiki |
| `langganan outlet Moka sudah habis` | outlet expired di Moka (mis. "X X X"), otomatis dilewati |
| Jadwal berhenti jalan | GitHub mematikan jadwal di repo publik setelah 60 hari tanpa commit → Actions → Enable workflow |
