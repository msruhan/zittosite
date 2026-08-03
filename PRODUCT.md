# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Tiga peran dengan kanal kerja yang berbeda:

- **User** — pemilik perangkat yang butuh aktivasi IMEI. Akunnya dibuat oleh Super Admin, bukan registrasi sendiri. Bekerja dari website atau Telegram bot, biasanya dari ponsel, dan datang untuk satu tujuan sempit: membuat order, membayar, lalu menunggu hasil.
- **Admin** — operator yang mengerjakan order secara manual. Bekerja **sepenuhnya dari Telegram**, tidak pernah membuka dashboard website. Menerima notifikasi order baru, mengambil order, menolak, dan mengirim hasil pengerjaan.
- **Super Admin** — pengelola sistem. Bekerja dari dashboard website untuk mengelola user, admin, layanan, order, dan memantau transaksi.

## Product Purpose

ZITTOSITE adalah platform order layanan aktivasi IMEI. User membuat order dan membayar, admin mengerjakan order secara manual, dan hasilnya dikembalikan ke user. Sukses berarti satu order berjalan dari pembuatan sampai hasil tanpa user perlu bertanya statusnya, dan tanpa admin perlu membuka website.

## Positioning

Hasil order diisi manual oleh admin, bukan hasil panggilan API provider eksternal. Konsekuensinya: seluruh operasional harian admin hidup di Telegram, dan website berperan sebagai portal user plus panel kontrol Super Admin — bukan sebagai tempat kerja admin. Ini membedakannya dari produk pendahulunya (CeirBot) yang bergantung pada API `Roamercheck`.

## Operating Context

Alur nyata satu order:

1. Super Admin membuat akun user.
2. User login ke website, lalu menautkan akun Telegram.
3. User memilih layanan, mengisi IMEI, dan membuat order. Order mendapat `Order ID` permanen.
4. Sistem menerbitkan invoice; user membayar lewat QRIS dengan batas waktu yang berjalan.
5. Setelah pembayaran terverifikasi, order masuk antrean admin dan disiarkan ke Telegram admin.
6. Admin pertama yang menekan `Terima Order` mengunci order tersebut (**first accept wins**).
7. Admin mengerjakan order, lalu mengirim hasil: status hasil, catatan, dan waktu selesai.
8. User menerima notifikasi Telegram dan dapat melihat hasil di website.

Status order yang mengikat seluruh produk: `Waiting Payment` → `Paid` → `Waiting Action` → `In Process` → `Done`, dengan jalur keluar `Rejected` (ditolak admin) dan `Cancel` (dibatalkan user/sistem/invoice kedaluwarsa).

User memeriksa status berulang kali sambil menunggu, sering dari ponsel. Super Admin memindai tabel padat berisi order, user, dan transaksi. Keduanya adalah pekerjaan membaca status, bukan menjelajah.

## Capabilities and Constraints

**Sudah pasti:**

- Stack: `Next.js`, `NestJS`, `PostgreSQL`, `Prisma`, `grammY` untuk Telegram bot.
- User dapat membuat order dari website maupun Telegram.
- Admin hanya beroperasi via Telegram; tidak ada dashboard admin di website.
- Setiap perubahan status mencatat entri `OrderActivityLog`.
- Order tidak boleh masuk antrean admin sebelum invoice berstatus `paid`.
- Pengambilan order harus atomic agar dua admin tidak mengambil order yang sama.
- IMEI ditampilkan sebagian tersamar di daftar (contoh `356XXXXXXXXXXXX`).

**Constraint sesi ini:**

- Pekerjaan tahap ini adalah **frontend saja**: Next.js dengan data mock. Belum ada NestJS, Prisma, atau Postgres yang berjalan. Kontrak data mock harus mencerminkan model yang tercatat di `frontend.md` agar penggantian ke API nyata tidak mengubah UI.
- Styling memakai Tailwind CSS v4 dengan primitives shadcn/ui.

**Belum diputuskan:**

- Payment gateway mana yang dipakai. Model datanya sudah disiapkan (`invoiceId`, `amount`, `paymentChannel`, `paymentReference`, `paymentStatus`, `expiredAt`, `paidAt`, `gatewayPayload`), tetapi integrasi aktif belum ada. QRIS di UI adalah placeholder yang ditandai.
- Apakah user boleh membatalkan order setelah status `Paid`. Default saat ini: tidak.

**Di luar cakupan MVP:** kanal WhatsApp, auto-assignment admin, SLA timer kompleks, multi-step approval finance, refund automation, integrasi provider eksternal.

## Brand Commitments

Ditetapkan pengguna dan bersifat mengikat:

- Nama produk **ZITTOSITE**, dengan penjelas **"Digital IMEI Activation Platform"**.
- Dunia visual sudah dipatok lewat mockup yang divalidasi dan tercatat lengkap di `frontend.md` §15: identitas biru (`#2563EB`) di atas permukaan putih, badge status berwarna per status, sidebar tetap di kiri, tabel ringan bergaris bawah saja. Ini bukan hipotesis dari repositori — ini brief yang harus dihormati apa adanya, tidak diperluas dan tidak diganti.
- Bahasa antarmuka: Bahasa Indonesia.

## Evidence on Hand

- `frontend.md` — spesifikasi sistem lengkap (§1–14) dan spesifikasi desain frontend (§15) mencakup token, layout, spesifikasi 11 layar, component library, motion, responsive, empty state, loading state, dan baseline aksesibilitas.
- Mockup tervalidasi berisi 15 layar: login, dashboard user, tampilan mobile, buat order, pembayaran QRIS, stepper status, detail order, riwayat order, dashboard Super Admin, manajemen user, modal edit user, dan manajemen order.

**Yang belum ada dan tidak boleh dikarang:** logo final sebagai file aset, harga layanan sungguhan selain contoh `Rp150.000`, kredensial atau endpoint payment gateway, data user dan order nyata. Semua data yang tampil di tahap ini adalah data contoh dan harus ditandai demikian.

## Product Principles

1. **Status adalah produknya.** Nilai utama tiap layar adalah menjawab "order saya sekarang di mana" tanpa user harus bertanya. Kejelasan status mengalahkan ekspresi visual.
2. **Admin tidak pernah menyentuh website.** Fitur apa pun yang mengasumsikan admin membuka browser adalah salah arah; tempatnya di Telegram.
3. **Satu order, satu identitas permanen.** `Order ID` adalah pegangan user, admin, dan Super Admin di semua kanal.
4. **Setiap transisi status meninggalkan jejak.** Riwayat aktivitas adalah bagian dari produk, bukan kemewahan operasional.
5. **Menunggu adalah state kelas satu.** Menunggu pembayaran dan menunggu admin adalah kondisi yang paling sering dilihat user, jadi keduanya dirancang, bukan disisakan.

## Accessibility & Inclusion

- Kontras warna minimum WCAG AA: 4.5:1 untuk teks normal, 3:1 untuk teks besar.
- Status tidak boleh disampaikan hanya lewat warna; badge selalu membawa teks.
- Setiap input punya `<label>` eksplisit, bukan hanya placeholder.
- Focus ring selalu terlihat dan tidak pernah dihilangkan.
- Motion menghormati `prefers-reduced-motion`.
- Mayoritas user membuka portal dari ponsel, sehingga layout mobile adalah kondisi utama, bukan penyesuaian belakangan.
