# Price List V26 — format Member/Retail dan harga pasti

Pembaruan ini memperbaiki tampilan rentang pada V25 dan menambahkan pemetaan katalog mengikuti contoh yang diberikan. Angka pada gambar November 2025 tidak disalin sebagai harga terbaru; harga tetap berasal dari data Item Library milik aplikasi.

## Pemasangan

1. Ekstrak ZIP dan simpan cadangan aplikasi yang sedang dipakai.
2. Jika SQL V25 sudah dipasang, **tidak perlu menjalankan SQL lagi**. Tabel dan fungsi Supabase tetap sama. Jika belum pernah memasang V25, jalankan `PRICE-LIST-V25.sql` di Supabase SQL Editor terlebih dahulu; diperlukan fungsi PIN aplikasi sebelumnya.
3. Di GitHub repository aplikasi → Add file → Upload files, unggah **tujuh file ini langsung ke folder yang sama dengan index.html lama**:

   - `index.html`
   - `price-list-v24.js`
   - `price-list-catalog-v26.js` (file baru, wajib ikut diunggah)
   - `price-list-ui-v24.js`
   - `price-list-seed-v24.json`
   - `price-colors-v24.json`
   - `PRICE-LIST-TEMPLATE-V24.csv`

4. Commit changes dan tunggu deployment Pages/Actions selesai. Refresh penuh aplikasi (Ctrl+Shift+R pada komputer). Judul Price List menyebut V26 dan terdapat tombol **Price List Member**, **Price List Retail**, serta **Tabel detail / Program & Cost**.
5. Data Supabase yang sudah tersimpan langsung memakai tampilan harga pasti; **tidak perlu mengosongkan database**. Jika sebelumnya belum menyimpan data awal, gunakan Simpan data awal sampai 12/12 toko tersimpan. Jika masih ada data mentah V24, tombol Ringkas data tersimpan tetap tersedia dengan PIN master/editor.

Paket belum dipasang otomatis ke GitHub atau Supabase produksi. SQL yang disertakan tidak perlu diunggah sebagai aset website.

## Pemetaan katalog

**Price List Member** menampilkan harga MK-01 per jenis produk, lengan pendek dan lengan panjang. Ejaan MK01 dari Samarinda tetap dikenali sebagai MK-01.

**Price List Retail** menampilkan baris pembelian 1–6 pcs (kolom Satuan Kaos Polos pada sumber), >6 pcs, >36 pcs dan Satuan MAMU sesuai kolom sumber yang terisi. Tier tanpa nilai tidak dipaksakan menjadi angka nol. Produk tanpa atribut lengan, seperti hoodie, tas dan perlengkapan lain, menggunakan kolom **Item lain**.

Header oranye dan kolom jenis produk mengikuti arah visual contoh. Filter kota, kategori, brand dan pencarian tetap tersedia. Kota tetap dipisah sembilan wilayah; empat outlet Makassar dapat digabung pada satu baris hanya apabila harga serta cakupan ukurannya sama. Nama outlet yang berlaku selalu ditampilkan.

Ukuran standar dengan pasangan harga yang sama digabung, contohnya S / M / L / XL. Big size ditampilkan sebagai tambahan terhadap harga standar hanya ketika ada satu kelompok standar yang jelas dan harga big size bisa dipasangkan tanpa menebak. Tambahan PDK dan PJG yang berbeda ditulis terpisah. Arahkan kursor ke tambahan big size untuk melihat harga aktual lengkap. Bila kondisi pembanding tidak terpenuhi, ukuran besar tetap ditampilkan pada baris tersendiri dengan harga aktual.

Jika sumber mencatat beberapa harga pada jenis dan ukuran yang sama, katalog memisahkan nilai tersebut dan menandainya sebagai **Varian harga sumber; periksa Tabel detail**. Aplikasi tidak membuat kombinasi pasangan PDK/PJG yang belum dapat dibuktikan dari data. Harga nol tetap Rp0; harga kosong tetap —. Perbedaan ini perlu diperbaiki pada data sumber atau lewat edit manual jika memang merupakan kesalahan input.

## Harga pasti dan data detail

Pada **Tabel detail / Program & Cost**, harga berbeda di kolom yang sedang terlihat menjadi baris terpisah. Memilih program tambahan dapat memecah baris lebih lanjut agar harga program tersebut juga selalu satu nilai pasti. Warna dan SKU tidak otomatis menjadi baris baru. Nol, harga berbeda dan data kosong tidak digabung menjadi rentang atau rata-rata.

Cost dapat memiliki beberapa nilai asli dalam satu kelompok harga jual. Setiap cost ditampilkan sebagai nilai terpisah; bila lebih dari dua nilai, buka **N nilai cost**. Tidak ada rentang cost. Tambah, edit, hapus, upload dan ekspor tetap tersedia; akses perubahan tetap memakai PIN master/editor. Katalog selalu menulis Rupiah lengkap agar daftar harga mudah dibaca dan tidak kehilangan presisi tampilan.

Data awal dalam paket diperbaiki untuk mempertahankan pembeda hoodie BT dan FL. **Data V25 yang sudah diringkas di Supabase tidak lagi memiliki nama asli untuk memulihkan label BT/FL secara otomatis.** Harganya tetap langsung dipisahkan oleh tampilan V26. Untuk memperbarui label model dari sumber asli, upload ulang file Item Library outlet tersebut melalui Upload / perbarui. Profil tambahan manual tetap dipertahankan, sedangkan edit pada profil impor mengikuti file upload baru. Jangan mengganti data yang telah diedit dengan data awal secara sembarang.

## Penyimpanan

Katalog Member/Retail dihitung di perangkat ketika menu dibuka, tanpa menambah tabel, menyimpan gambar atau membuat salinan data katalog ke database. Format kompak V25 tetap dipakai: harga yang identik berbagi referensi per outlet, tidak ada daftar SKU/warna impor yang berulang, dan upload mengganti dokumen outlet yang sama. JSON data awal sekitar 4,05 MB; ukuran tabel fisik Supabase tergantung kompresi, indeks dan versi baris PostgreSQL.

Tidak ada sinkronisasi otomatis Google Drive; perubahan berikutnya melalui upload atau input manual. File sumber mentah tetap menjadi acuan audit warna/SKU yang tidak disimpan pada format kompak. Data sales, H2H, SSSG dan tabel lain tidak diubah.

## Pemeriksaan

Laporan validation mencakup kesetaraan nilai harga/cost dan jumlah item asal dari 12 file; harga tunggal pada setiap kolom terlihat, termasuk semua program yang dipilih; pemisahan hoodie Bone Rp199.000/Rp229.000; kompatibilitas data V25; pasangan lengan dan tambahan big size; penanganan harga nol/konflik; CRUD/upload/migrasi; render 24 menu; serta database lokal untuk PIN dan pemeriksaan versi. Pemeriksaan browser memastikan katalog Retail menampilkan ukuran standar serta tambahan big size dengan angka sumber. Pengujian tidak menulis ke produksi.
