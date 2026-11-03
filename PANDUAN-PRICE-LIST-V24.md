# Commercial Dept — Price List V24

Menu Price List berisi data awal dari 12 CSV Item Library pada folder Google Drive yang diberikan, diambil pada 3 November 2026. Seluruh 81.610 baris sumber dipertahankan dan disajikan sebagai 8.595 kombinasi kota/model. Ini merupakan salinan data saat pengambilan, bukan koneksi otomatis yang memantau perubahan Google Drive.

## Pemasangan

1. Ekstrak ZIP ini. Simpan cadangan file aplikasi yang sedang dipakai.
2. Buka proyek Supabase yang digunakan aplikasi → SQL Editor → New query. Salin seluruh isi `PRICE-LIST-V24.sql`, lalu Run. Script ini memerlukan fungsi akses PIN `commercial_pin_session_v1()` dari pemasangan aplikasi sebelumnya. Jika fungsi tersebut belum ada, script berhenti tanpa menyimpan perubahan; pasang akses PIN versi sebelumnya terlebih dahulu. Jangan membuat PIN atau password baru lewat script ini.
3. Di repository GitHub aplikasi → Add file → Upload files, unggah **enam file berikut ke folder yang sama dengan index.html lama**. Pilih file langsung, jangan unggah folder pembungkus:

   - `index.html`
   - `price-list-v24.js`
   - `price-list-ui-v24.js`
   - `price-list-seed-v24.json`
   - `price-colors-v24.json`
   - `PRICE-LIST-TEMPLATE-V24.csv`

4. Commit changes. Tunggu deployment GitHub Pages/Actions selesai. Buka ulang aplikasi dan lakukan refresh penuh. File SQL, panduan, dan folder validation tidak perlu dipasang sebagai aset website.
5. Buka menu **Price List**. Awalnya data sumber sudah dapat dilihat, tetapi belum tersimpan sebagai data yang dapat diubah di Supabase. Tekan **Simpan data awal**, gunakan akses PIN master/editor yang sudah ada, dan tunggu status **12 / 12 toko tersimpan**. SQL pada langkah 2 hanya membuat tabel dan fungsi; tindakan ini yang memasukkan data awalnya.
6. Jika proses berhenti, baca pesan kesalahan dan ulangi Simpan data awal. Toko yang sudah tersimpan tidak diinisialisasi ulang. Periksa rincian salah satu model dan pastikan harga, biaya, serta outletnya benar.

Paket ini belum dipasang ke GitHub atau Supabase produksi. Pengujian penulisan dilakukan pada database lokal dan simulasi RPC, bukan data produksi.

## Isi dan pengelompokan

| Kota | Outlet sumber |
| --- | --- |
| MAKASSAR | MAMU BTP, MAMU MAKASSAR, TIGALAPANKAOS MAKASSAR, MAMU GOWA |
| PALOPO | MAMU PALOPO |
| TORAJA | TIGALAPANKAOS TORAJA |
| SAMARINDA | TIGALAPANKAOS SAMARINDA |
| BONE | TIGALAPANKAOS BONE |
| POLMAN | TIGALAPANKAOS POLMAN |
| PALU | TIGALAPANKAOS PALU |
| MANADO | TIGALAPANKAOS MANADO |
| KENDARI | MAMU KENDARI |

Category dan Brand diambil dari kolom sumber. Nama model menghilangkan frasa warna yang dikenali, dengan mempertahankan pembeda seperti PDK/PJG, ukuran, RIB, MYNO, HANDLE, OVAL, dan ukuran dimensi. Kata yang belum dikenali tetap disimpan agar model tidak tergabung secara keliru; descriptor model bisa diperbaiki manual. Nama item asli, SKU, harga dan biaya setiap varian tetap tersedia pada Rincian / Edit dan ekspor.

Empat kolom utama adalah MK-01 - Price (Member), RETAIL >36 PCS - Price, RETAIL >6 PCS - Price, dan RETAIL SATUAN KAOS POLOS - Price. Ejaan `MK01 - Price` pada Samarinda dikenali sebagai Member. Seluruh **83 nama kolom harga program asli** lintas sumber tetap disimpan; pilih kolom tambahan melalui pilihan kolom harga atau buka panel seluruh harga pada rincian. Kolom yang tidak ada pada suatu sumber ditampilkan sebagai kosong, bukan dianggap nol.

Jika harga atau Cost Amount berbeda menurut varian atau outlet, daftar menampilkan rentang harga. Buka rincian untuk melihat profil yang berbeda. Angka nol tetap nol, sedangkan data kosong tetap kosong. Tidak ada harga atau biaya sumber yang dipilih secara sembarang untuk mewakili semua warna. Footer menampilkan cakupan/jumlah data; harga satuan tidak dijumlahkan menjadi total yang menyesatkan.

## Penggunaan

- Filter kota, kategori, brand dan pencarian bisa digabungkan. Pencarian juga dapat menemukan nama item asli/SKU. Pilihan beberapa filter tetap terbuka selama memilih.
- Tabel menampilkan 50 baris per halaman; semua hasil tetap dapat diakses melalui halaman selanjutnya. Pilihan kolom yang banyak dapat digeser horizontal. Mode angka penuh/ringkas mengikuti pengaturan aplikasi.
- **Rincian / Edit** menampilkan profil per outlet, seluruh harga program dan varian sumber. Akses tulis memakai PIN master/editor aplikasi yang sudah ada.
- **Tambah manual** membuat profil baru untuk outlet yang dipilih. Edit profil untuk mengubah kategori, brand, model, harga dan biaya. Biaya manual disimpan sebagai penyesuaian, sehingga biaya sumber tetap dapat diperiksa. Gunakan pilihan kembali ke biaya sumber jika diperlukan.
- **Hapus profil** menghapus profil yang dipilih beserta variannya setelah konfirmasi. Outlet/profil lain tidak dihapus. Ekspor dahulu jika membutuhkan cadangan sebelum menghapus.
- **Ekspor CSV** mengeluarkan seluruh hasil filter, bukan hanya halaman yang terlihat. File mempertahankan nama item asli, SKU, semua kolom program, biaya asli dan penyesuaian biaya.

## Upload pembaruan

1. Buka Price List → **Upload / perbarui**, atau masuk melalui kartu Price List di menu Upload Data.
2. Gunakan CSV Item Library Moka asli atau unduh template CSV dari form. Pertahankan header Category, Items Name (Do Not Edit), Brand/Brand Name, Cost Amount dan kolom harga berakhiran ` - Price`. Excel dapat dibaca jika pustaka Excel aplikasi berhasil dimuat; CSV tidak memerlukan pustaka tersebut.
3. Untuk beberapa file, pertahankan pola nama `Item Library - NAMA TOKO - …csv` dan gunakan deteksi otomatis. Untuk satu file dengan nama berbeda, pilih toko secara eksplisit.
4. Periksa pratinjau: toko, kota, jumlah baris, kolom program dan pesan validasi. Berkas tidak valid tidak disimpan. Dua file untuk outlet yang sama dalam satu batch ditolak agar penggantian tidak ambigu.
5. Tekan **Simpan hasil upload**, gunakan PIN yang berhak mengubah data, dan tunggu hasilnya. Masing-masing outlet disimpan sebagai satu transaksi. Satu batch banyak outlet bukan satu transaksi global; jika sebagian gagal, status menunjukkan hasilnya dan proses dapat diulang.

Upload mengganti profil hasil impor **untuk outlet tersebut saja**. Profil yang ditambahkan manual tetap dipertahankan, termasuk saat kolom program file baru berbeda. **Perubahan manual pada profil yang berasal dari impor akan mengikuti file sumber baru pada upload berikutnya.** Jika suatu penyesuaian harus tetap menjadi data terpisah, buat profil manual dan pastikan tidak menduplikasi harga yang seharusnya hanya satu.

## Penyimpanan dan keandalan

Data disimpan dalam tabel khusus `commercial_price_list_v24`, sebagai satu dokumen terkini per outlet. File CSV mentah tidak diunggah ke Supabase Storage. Pembaruan mengganti dokumen outlet, bukan terus menambahkan seluruh riwayat upload. Tetap ada penggunaan ruang database dan mekanisme versi baris PostgreSQL; ukur pemakaian aktual melalui Supabase setelah pemasangan.

Data awal sekitar 8,6 MB dalam JSON sebelum kompresi pengiriman. Aset Price List baru dimuat ketika menu dibuka, sehingga tidak menambah unduhan awal menu lainnya. Penyimpanan dilindungi pemeriksaan versi: perubahan dari perangkat lain tidak ditimpa tanpa memuat ulang. Jika pembacaan database gagal, aplikasi memberi tanda bahwa data referensi awal sedang ditampilkan dan menonaktifkan penyimpanan sampai pembacaan berhasil.

Hak baca mengikuti pola koneksi publishable/anon aplikasi yang sudah ada. Penulisan langsung tabel ditolak; perubahan melalui fungsi khusus dengan PIN master/editor. Fungsi SQL hanya menyentuh tabel Price List. Script V24 tidak mengubah data sales, target, login atau pengaturan sebelumnya.

## Pemeriksaan yang disertakan

Folder `validation` mencatat rekonsiliasi semua baris/nilai terhadap 12 CSV asli; pengujian parser, nol/kosong, nama model; filter, pencarian, halaman, angka penuh/ringkas, CRUD dan penggantian upload; pemeriksaan database lokal untuk PIN, konflik versi, dan isolasi outlet; serta pemeriksaan render 24 menu dalam kedua mode angka. Pengujian lokal ini tidak menjamin kondisi jaringan atau konfigurasi Supabase produksi. Rumus sales/H2H/SSSG versi sebelumnya tidak diubah pada pembaruan Price List ini.
