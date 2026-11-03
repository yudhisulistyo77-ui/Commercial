# Price List V25 — kategori/ukuran, harga terlihat, penyimpanan ringkas

Pembaruan ini memperbaiki Price List V24. Menu lain dan perhitungan sales tidak diubah. Data awal tetap berasal dari 12 file Drive yang diberikan, mencakup 9 kota dan 81.610 item sumber. Data tersebut sekarang ditampilkan sebagai 4.537 kombinasi kota, kategori, brand dan jenis/ukuran. Daftar bukan lagi daftar warna atau SKU.

## Pemasangan langkah demi langkah

1. Ekstrak ZIP. Simpan cadangan aplikasi lama dan CSV sumber jika diperlukan; versi ringkas tidak menyimpan rincian warna/SKU hasil impor.
2. Di proyek **Supabase → SQL Editor → New query**, salin seluruh `PRICE-LIST-V25.sql`, lalu Run. Jalankan script V25 ini juga jika script V24 sudah pernah dipasang. Script memperbarui fungsi penyimpanan untuk menerima harga yang dipadatkan, tetap memakai tabel `commercial_price_list_v24` yang sama dan PIN master/editor yang sudah ada. Data tabel tidak dikosongkan oleh pemasangan SQL. Jika fungsi PIN lama belum terpasang, script berhenti tanpa perubahan; pemasangan akses PIN sebelumnya tetap diperlukan.
3. Di **GitHub repository aplikasi → Add file → Upload files**, unggah keenam file berikut langsung di folder yang sama dengan index.html lama, lalu Commit changes:

   - `index.html`
   - `price-list-v24.js`
   - `price-list-ui-v24.js`
   - `price-list-seed-v24.json`
   - `price-colors-v24.json`
   - `PRICE-LIST-TEMPLATE-V24.csv`

   Nama aset tetap memakai v24 untuk menggantikan file sebelumnya, sedangkan isi kode dan datanya sudah V25. Jangan mencampur file JS baru dengan JSON/kode lama. SQL dan folder validation tidak perlu dipasang ke website.
4. Tunggu deployment GitHub Pages/Actions selesai. Refresh penuh aplikasi (Ctrl+Shift+R pada desktop). Judul Price List akan menyebut **penyimpanan ringkas V25**.
5. Jika Price List sebelumnya sudah tersimpan di Supabase: buka **Price List → Ringkas data tersimpan → Simpan versi ringkas**, gunakan PIN master/editor dan tunggu selesai. Tindakan ini mengganti rincian warna/SKU Price List lama dengan kelompok harga. Harga, cost unik dan jumlah item asal tetap dipertahankan. Jalankan pada V25 setelah SQL V25 terpasang. Bila proses terhenti, ulangi untuk outlet yang belum selesai.
6. Jika belum pernah menyimpan data awal: tekan **Simpan data awal** sampai status **12 / 12 toko tersimpan**. Bila hanya sebagian toko yang sebelumnya tersimpan, selesaikan kedua proses sesuai tombol yang tampil.
7. Pilih kategori, misalnya COMBED 24S, dan kota. Harga Member/Retail/Satuan harus langsung terlihat pada tabel. Gunakan **Rincian / Edit** untuk nilai dari masing-masing outlet atau kelompok harga yang berbeda.

Paket ini telah diuji lokal; pemasangan ke GitHub/Supabase produksi belum dilakukan otomatis.

## Apa yang berubah

- Satu baris utama mengikuti **Kota + Category + Brand + Jenis/Ukuran**, tanpa menjadikan warna, SKU, cost atau perbedaan program sebagai pembeda baris utama.
- Untuk pakaian, atribut diambil langsung dari nama: PDK/PJG/SS/LS, ukuran, RIB, MYNO serta jenis konstruksi yang relevan. Nama seri cetak dalam kategori graphic/print dirangkum. Contoh: semua warna `... 24S PDK L` menjadi **COMBED 24S · PDK · L**. Ukuran dan lengan berbeda tetap terpisah.
- Model nonpakaian tetap membedakan HANDLE/OVAL dan dimensi, bahan/penutup totebag, ukuran kemasan serta kode teknis yang membedakan produk. Nama jenis/ukuran dapat diedit melalui profil jika produk baru memerlukan penamaan khusus.
- Makassar menggabungkan tampilan MAMU BTP, MAMU MAKASSAR, TIGALAPANKAOS MAKASSAR, MAMU GOWA. Harga asli setiap outlet tetap dapat diperiksa pada rincian. Delapan kota lain: PALOPO, TORAJA, SAMARINDA, BONE, POLMAN, PALU, MANADO, KENDARI.
- Kolom **Member (MK-01), Retail >36 PCS, Retail >6 PCS, Satuan Kaos Polos dan Satuan MAMU** selalu tampil. Pilihan program hanya menambah kolom; mengosongkan pilihan program tidak menghilangkan harga utama. Ejaan MK01 pada Samarinda tetap dikenali sebagai Member. Seluruh 83 nama kolom harga sumber tetap tersedia.
- Tanda **—** berarti data harga tersebut kosong/tidak tersedia, bukan otomatis nol. Nol sumber tetap nol. Jika ada beberapa harga/cost untuk kelompok yang sama, tampilkan rentang dan rincian; aplikasi tidak menebak satu harga untuk semuanya. Produk MAMU dapat memiliki harga pada Satuan MAMU sementara harga Kaos Polos kosong.
- Category, Brand dan Jenis/Ukuran ditumpuk dalam satu kolom identitas agar tabel lebih padat. Tabel dapat digeser horizontal ketika kolom program ditambah; 50 baris per halaman mengurangi beban tampilan. Filter kota/kategori/brand, pencarian dan pengurutan tetap tersedia.

## Penyimpanan dan upload

Database menyimpan kelompok jenis/ukuran, kombinasi harga yang berbeda, biaya unik dan jumlah item asal. Harga yang identik memakai satu referensi vektor per outlet agar daftar harga berulang tidak disalin berkali-kali. Nama warna dan SKU setiap baris impor tidak disimpan lagi. Hubungan biaya dengan SKU/warna tertentu juga tidak tersedia dalam versi ringkas; CSV sumber menjadi acuan bila analisis tersebut diperlukan. Nilai harga/cost unik tetap lengkap.

JSON awal turun dari **8.613.417 byte menjadi 4.014.453 byte**, sekitar **53,4% lebih kecil**. Angka ini adalah ukuran payload JSON, bukan janji ukuran tabel fisik Supabase: indeks, format JSONB, kompresi PostgreSQL dan versi baris bekas memengaruhi angka database. Penggantian data lama tidak menjamin angka disk langsung turun. Data Price List hanya dimuat saat menu dibuka. Tabel sales dan file Storage tidak disentuh.

**Upload / perbarui** menerima CSV Item Library asli, dan Excel apabila pembaca Excel aplikasi termuat. Gunakan nama `Item Library - NAMA TOKO - ...csv`, atau pilih outlet manual untuk satu file. Header wajib: Category, Items Name (Do Not Edit), Brand/Brand Name, Cost Amount dan kolom program ` - Price`. Template tersedia dalam form. Data dibaca dan diringkas di perangkat sebelum dikirim ke database. Periksa pratinjau sebelum Simpan.

Upload baru mengganti data impor untuk outlet yang dipilih, sehingga tidak menambah salinan riwayat upload setiap kali. Profil Tambah manual tetap dipertahankan. Edit pada profil impor akan mengikuti file sumber saat outlet diupload ulang; profil manual tetap terpisah. Satu penyimpanan outlet bersifat atomik dan terlindungi pemeriksaan versi; batch banyak outlet tidak menjadi satu transaksi global. Bila satu outlet gagal, status menunjukkan hasil yang sudah tersimpan.

Tambah/edit/hapus tetap menggunakan PIN master/editor. Rincian berisi profil harga per outlet, bukan tabel SKU. Ekspor CSV menghasilkan kelompok harga untuk seluruh hasil filter, termasuk semua kolom program dan biaya, tanpa memperbanyak baris menjadi SKU. Untuk biaya yang berbeda, ekspor mencantumkan nilai unik dipisahkan `/`.

Tidak ada sinkronisasi otomatis perubahan folder Google Drive. Pembaruan berikutnya melalui upload/manual. Jangan membuka versi aplikasi lama untuk mengedit Price List setelah data diringkas; kode V25 diperlukan untuk membaca referensi harga.

## Pemeriksaan

Laporan dalam validation mencatat pemeriksaan pengelompokan pakaian dan nonpakaian, seluruh jumlah item asal, kesetaraan nilai harga/cost per kelompok pada semua 12 outlet, kompresi dan pemulihan harga, CRUD/upload, migrasi data V24, filter serta tampilan angka. Database lokal memeriksa PIN, penolakan tulis langsung, harga negatif, konflik versi dan isolasi outlet. Render 24 menu diperiksa pada angka penuh/ringkas. Pemeriksaan browser memastikan harga Combed dan Satuan MAMU terlihat. Pengujian ini tidak menulis ke database produksi dan tidak mengukur performa jaringan produksi.
