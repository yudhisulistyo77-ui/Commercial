# Sales Command — Commercial Dept Dashboard

Dasbor penjualan internal (bahasa Indonesia) untuk tim Commercial: Dashboard, Sales & Target,
Item Sales, Transaksi & AOV, KPI Scorecard, Plan-Do-Check-Action, PICA/MOM, H2H Sales,
Breakdown Problem (5 Why), Marketplace, Brand Performance, Top Product, Upload Data, dan
Pengaturan. Didukung oleh Supabase (project `qrabkayuwglmlaouliwn`).

## Struktur

Ini adalah **static single-file app**: seluruh dashboard ada di satu file `index.html`
(HTML + CSS + JavaScript inline, tanpa build step, tanpa framework, tanpa dependency npm).
Tidak ada proses build — file ini langsung bisa di-serve apa adanya oleh web server statis mana pun.

## Deploy otomatis

Repo ini bisa disambungkan ke layanan hosting statis mana pun untuk deploy otomatis setiap `git push`:

- **publish/output directory:** `/` (root repo)
- **build command:** (kosongkan — tidak ada build step)

### Netlify

Site Netlify yang sudah ada (`dashboard-commercialopr.netlify.app`) sebelumnya di-deploy manual
lewat drag-and-drop zip. Untuk beralih ke deploy otomatis dari repo ini:

1. Buka situs itu di dashboard Netlify → **Site settings → Build & deploy → Link repository**.
2. Pilih repo GitHub ini (`yudhisulistyo77-ui/commercial`), branch `main`.
3. Build command: kosongkan. Publish directory: `/`.
4. Setelah tersambung, setiap `git push` ke `main` akan otomatis men-deploy ulang situs —
   tidak perlu lagi upload zip manual.

### GitHub Pages

Repo ini juga bisa langsung di-serve lewat GitHub Pages (branch `main`, folder `/`) sebagai
contoh deploy berbasis git yang langsung aktif tanpa langkah tambahan di layanan lain.

## Update dashboard

Setiap kali `index.html` berubah, commit dan push ke `main` — layanan hosting yang sudah
disambungkan (Netlify dan/atau GitHub Pages) akan otomatis mengambil versi terbaru.
