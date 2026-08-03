# CeirBot Successor — Website + Telegram Manual Order Workflow Design

**Date:** 2026-07-29  
**Status:** Draft  
**Product:** Project baru dengan stack yang sama seperti CeirBot (`Next.js` + `NestJS` + `PostgreSQL` + `Prisma` + `Telegram Bot`), tetapi domain bisnis lebih sederhana: order manual tanpa integrasi `Roamercheck`.

---

## 1. Goal

Membangun sistem order layanan berbasis Website + Telegram Bot dengan prinsip:

1. **User** dapat membuat order dari website maupun Telegram bot.
2. **Admin** memproses seluruh order dari Telegram bot, tanpa perlu membuka dashboard website.
3. **Super Admin** mengelola user, admin, layanan, order, dan konfigurasi sistem dari dashboard website.
4. Sistem **tidak menggunakan API Roamercheck**; hasil order diisi manual oleh admin.
5. Struktur pembayaran sudah disiapkan untuk **payment gateway**, walaupun integrasi aktif bisa datang pada tahap berikutnya.

**Success criteria (MVP):**

- User dapat login ke website dan menautkan Telegram dengan flow yang sama seperti CeirBot saat ini.
- User dapat membuat order dari website atau Telegram bot dan menerima `Order ID` permanen.
- Setiap order mengikuti status workflow yang konsisten: `Waiting Payment` -> `Paid` -> `Waiting Action` -> `In Process` -> `Done`.
- Admin menerima notifikasi order baru via Telegram, lalu bisa `Terima`, `Tolak`, dan `Done` langsung dari bot.
- Website user menampilkan status dan hasil order, sementara website super admin menampilkan seluruh operasional sistem.

---

## 2. Decisions

| Topik             | Keputusan                                                                    |
| ----------------- | ---------------------------------------------------------------------------- |
| Tech stack        | Sama seperti CeirBot: `Next.js`, `NestJS`, `PostgreSQL`, `Prisma`, `grammY`  |
| Channel user      | Website + Telegram                                                           |
| Channel admin     | Telegram only                                                                |
| Link Telegram     | Mengikuti flow linking CeirBot saat ini                                      |
| Payment           | Siapkan model payment gateway, implementasi aktif bisa menyusul              |
| Tipe order        | Manual workflow, bukan hasil API eksternal                                   |
| Multi-admin       | Notifikasi boleh broadcast, tetapi **first accept wins**                     |
| Status penolakan  | `Rejected` untuk penolakan admin                                             |
| Status pembatalan | `Cancel` untuk pembatalan user, sistem, atau order yang expired              |
| Format hasil      | Semi-terstruktur: status hasil, catatan admin, waktu selesai, admin pemroses |

---

## 3. Architecture

```text
User Website ─────▶ Next.js `/app/*` ───────▶ NestJS API ───────▶ PostgreSQL
User Telegram ────▶ Telegram Bot ───────────▶ NestJS API ───────▶ Prisma
Admin Telegram ───▶ Telegram Bot ───────────▶ Order Workflow
Super Admin Web ──▶ Next.js `/admin/*` ─────▶ Admin REST API
```

### Route map (`apps/web`)

| Area         | Path           | Audience    |
| ------------ | -------------- | ----------- |
| Public auth  | `/login`       | User        |
| User portal  | `/app/*`       | User        |
| Admin auth   | `/admin/login` | Super Admin |
| Admin portal | `/admin/*`     | Super Admin |

### Component roles

| Komponen                   | Peran                                                                   |
| -------------------------- | ----------------------------------------------------------------------- |
| Next.js user portal        | Membuat order, bayar, lihat status, lihat hasil                         |
| Next.js super admin portal | Kelola user, admin, layanan, order, dashboard                           |
| NestJS auth module         | Login user dan session admin                                            |
| NestJS order module        | Create order, ubah status, simpan hasil                                 |
| NestJS payment module      | Buat invoice, simpan status pembayaran, siapkan hook payment gateway    |
| NestJS telegram module     | Linking user/admin, notifikasi, action admin via bot                    |
| PostgreSQL + Prisma        | Sumber data tunggal untuk user, order, invoice, hasil, dan activity log |

---

## 4. Product roles

### User

User menggunakan layanan melalui website atau Telegram bot.

**Hak akses utama:**

- membuat order
- request payment
- melihat instruksi pembayaran
- melihat status order
- melihat riwayat order
- menerima notifikasi Telegram
- melihat hasil order setelah selesai

### Admin

Admin tidak perlu membuka website untuk operasional harian.

**Hak akses utama via Telegram:**

- menerima notifikasi order baru
- mengambil order
- menolak order
- menandai order selesai
- mengirim hasil pengerjaan
- melihat detail order singkat

### Super Admin

Super Admin bekerja melalui dashboard website.

**Hak akses utama:**

- kelola user
- kelola admin
- kelola layanan
- kelola order
- memantau transaksi
- melihat statistik dashboard
- override status order bila diperlukan

---

## 5. User flow

### 5.1 Account and Telegram linking

1. Super Admin membuat akun user.
2. User login ke website.
3. User menautkan Telegram menggunakan mekanisme linking yang sama seperti CeirBot saat ini.
4. Setelah link berhasil, user dapat menerima notifikasi dan membuat order dari bot.

### 5.2 Create order from website

1. User memilih layanan.
2. User mengisi data order, misalnya IMEI dan catatan tambahan.
3. Sistem membuat `Order ID`.
4. Status order awal: `Waiting Payment`.
5. User melakukan request payment.
6. Sistem membuat invoice.
7. Setelah pembayaran terverifikasi, order masuk ke antrean admin.

### 5.3 Create order from Telegram bot

1. User membuka bot dan memilih `Buat Order`.
2. Bot meminta data order secara bertahap.
3. Bot menampilkan ringkasan order.
4. User konfirmasi.
5. Sistem membuat order dan invoice dengan status `Waiting Payment`.
6. Setelah payment terverifikasi, user menerima notifikasi bahwa order siap diproses admin.

---

## 6. Payment design

Payment gateway belum harus aktif di MVP, tetapi model datanya harus siap.

### Payment assumptions

- Satu order memiliki satu invoice aktif pada satu waktu.
- Payment record dipisah dari order agar mudah dihubungkan ke gateway manapun.
- Sistem perlu menyimpan:
  - `invoiceId`
  - `orderId`
  - `amount`
  - `paymentChannel`
  - `paymentReference`
  - `paymentStatus`
  - `expiredAt`
  - `paidAt`
  - `gatewayPayload` raw opsional

### Payment status recommendation

- `pending`
- `paid`
- `failed`
- `expired`
- `cancelled`

### MVP policy

- Integrasi gateway boleh dummy atau placeholder terlebih dahulu.
- Order tidak boleh masuk ke admin sebelum invoice berstatus `paid`.
- Jika invoice expired, order dapat berubah ke `Cancel`.

---

## 7. Order workflow

### Normal flow

```text
Create Order
        │
        ▼
Waiting Payment
        │
        ▼
Paid
        │
        ▼
Waiting Action
        │
        ▼
In Process
        │
        ▼
Done
```

### Alternative exits

```text
Waiting Payment ─────────▶ Cancel
Waiting Action ──────────▶ Rejected
In Process ──────────────▶ Rejected
```

### Status definitions

| Status            | Arti                                                |
| ----------------- | --------------------------------------------------- |
| `Waiting Payment` | Order dibuat, belum dibayar                         |
| `Paid`            | Pembayaran sudah diverifikasi                       |
| `Waiting Action`  | Siap diambil admin                                  |
| `In Process`      | Sedang dikerjakan admin                             |
| `Done`            | Hasil order sudah selesai                           |
| `Rejected`        | Order ditolak admin                                 |
| `Cancel`          | Order dibatalkan user, sistem, atau invoice expired |

### Recommendation

- User tidak disarankan membatalkan order setelah status `Paid`, kecuali ada aturan bisnis khusus.
- `Rejected` dan `Cancel` harus dipisah agar laporan operasional dan finansial tetap jelas.

---

## 8. Admin workflow in Telegram

### 8.1 New order notification

Saat order siap diproses, bot mengirim pesan:

```text
ORDER BARU

Order ID: ZT2507250001
IMEI: 356XXXXXXXXXXXX
Layanan: CEIR Register
Status: Waiting Action

[Terima Order]
[Tolak]
```

### 8.2 Accept order

Saat admin memilih `Terima Order`, sistem:

1. memverifikasi bahwa order masih `Waiting Action`
2. mengunci order untuk admin pertama yang berhasil mengambil
3. mengubah status menjadi `In Process`
4. menyimpan `assignedAdminId` dan `startedAt`
5. mengirim notifikasi ke user

### 8.3 Reject order

Saat admin memilih `Tolak`, sistem:

1. mengubah status menjadi `Rejected`
2. menyimpan alasan penolakan opsional
3. mengirim notifikasi ke user

### 8.4 Finish order

Saat admin memilih `Done`, bot meminta hasil pengerjaan:

- `resultStatus`
- `resultNote`
- opsional metadata tambahan

Setelah dikirim:

1. status order berubah menjadi `Done`
2. hasil order disimpan
3. `completedAt` dicatat
4. user menerima notifikasi hasil

---

## 9. Super Admin website

### Dashboard

Dashboard menampilkan:

- total user
- total admin
- total order
- total pendapatan
- order hari ini
- grafik transaksi
- statistik status order

### User management

Super Admin dapat:

- tambah user
- edit user
- suspend user
- hapus user
- reset password
- aktif/nonaktif akses Telegram bot

### Admin management

Super Admin dapat:

- tambah admin
- hapus admin
- blokir atau aktifkan admin
- atur hak akses sederhana jika diperlukan

### Service management

Super Admin dapat mengatur:

- nama layanan
- harga layanan
- status aktif/nonaktif
- estimasi pengerjaan
- deskripsi layanan

### Order management

Super Admin dapat:

- melihat seluruh order
- mencari order berdasarkan `Order ID`, IMEI, user, atau layanan
- melihat detail order
- melihat hasil order
- melihat riwayat aktivitas order
- mengubah status secara manual bila benar-benar diperlukan

---

## 10. Data model recommendation

### Core entities

- `User`
- `Admin`
- `UserIdentity` / telegram linking
- `Service`
- `Order`
- `OrderResult`
- `PaymentInvoice`
- `OrderActivityLog`

### Suggested order fields

- `id`
- `orderId`
- `userId`
- `serviceId`
- `channel` (`web` / `telegram`)
- `imei`
- `notes`
- `status`
- `assignedAdminId`
- `startedAt`
- `completedAt`
- `createdAt`
- `updatedAt`

### Suggested order result fields

- `id`
- `orderId`
- `resultStatus`
- `resultNote`
- `resultData`
- `createdByAdminId`
- `createdAt`

---

## 11. Error handling and operational rules

### Recommended operational rules

- Accept order must be atomic to prevent two admins taking the same order.
- Telegram callbacks must validate current order status before changing anything.
- Only assigned admin or super admin should be able to mark an order `Done`.
- Status change should always create an `OrderActivityLog`.
- Payment verification webhook should be idempotent.

### User-facing error cases

- order not found
- invoice expired
- order already taken by another admin
- order already finished
- Telegram account not linked
- service inactive

---

## 12. Testing focus

MVP testing should cover:

1. user login and Telegram linking
2. order creation from web
3. order creation from Telegram
4. invoice creation
5. payment verification to `Paid`
6. transition `Paid` -> `Waiting Action`
7. first accept wins for multi-admin
8. reject flow
9. done flow with result persistence
10. user notification delivery

---

## 13. Out of scope for MVP

Hal berikut sebaiknya tidak masuk MVP awal:

- WhatsApp channel
- auto-assignment admin
- SLA timer kompleks
- attachment hasil yang rumit
- multi-step approval finance
- refund automation yang kompleks
- integrasi provider eksternal seperti `Roamercheck`

---

## 14. Summary

Project baru ini mempertahankan fondasi teknis CeirBot, tetapi mengganti domain utama dari **check otomatis berbasis API** menjadi **manual order workflow berbasis Telegram**. Website fokus pada user portal dan super admin dashboard, sementara Telegram bot menjadi pusat operasional admin dan kanal notifikasi user.

---

## 15. Frontend Design Specification

> Berdasarkan referensi desain ZITTOSITE yang sudah divalidasi. Spesifikasi ini menjadi acuan implementasi UI untuk seluruh halaman website (user portal dan super admin dashboard).

---

### 15.1 Visual Identity & Design Tokens

#### Color Palette

| Token | Hex | Penggunaan |
| --- | --- | --- |
| `primary` | `#2563EB` | Button utama, sidebar aktif, link, aksen brand |
| `primary-hover` | `#1D4ED8` | Hover state button primary |
| `primary-light` | `#EFF6FF` | Background highlight, badge ringan |
| `surface` | `#FFFFFF` | Background halaman, card |
| `surface-secondary` | `#F8FAFC` | Background sidebar, tabel header, input disabled |
| `border` | `#E2E8F0` | Divider, border card, border input |
| `text-primary` | `#0F172A` | Heading, label penting |
| `text-secondary` | `#64748B` | Label sekunder, metadata, placeholder |
| `text-muted` | `#94A3B8` | Teks sangat ringan, hint |

#### Status Badge Colors

| Status | Background | Text | Border |
| --- | --- | --- | --- |
| `Waiting Payment` | `#FEF9C3` | `#854D0E` | `#FDE047` |
| `Paid` | `#DCFCE7` | `#166534` | `#86EFAC` |
| `Waiting Action` | `#EDE9FE` | `#5B21B6` | `#C4B5FD` |
| `In Process` | `#FEF3C7` | `#92400E` | `#FCD34D` |
| `Done` | `#DCFCE7` | `#166534` | `#86EFAC` |
| `Rejected` | `#FEE2E2` | `#991B1B` | `#FCA5A5` |
| `Cancel` | `#F1F5F9` | `#475569` | `#CBD5E1` |

#### Typography

| Role | Font | Weight | Size |
| --- | --- | --- | --- |
| Display / heading utama | `Inter` atau `Poppins` | 700 | 24–32px |
| Heading section | — | 600 | 18–20px |
| Body / label | — | 400–500 | 14–16px |
| Caption / metadata | — | 400 | 12px |
| Badge / tag | — | 600 | 11–12px, uppercase |

#### Spacing & Shape

| Elemen | Nilai |
| --- | --- |
| Border radius card | `10px` |
| Border radius button | `8px` |
| Border radius badge | `999px` (full pill) |
| Border radius input | `8px` |
| Card padding | `20–24px` |
| Section gap | `24px` |
| Sidebar width | `220px` |
| Sidebar collapsed (mobile) | `hidden` / drawer |

#### Shadow

```css
/* Card */
box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);

/* Dropdown / popover */
box-shadow: 0 4px 16px rgba(0,0,0,0.10);

/* Modal */
box-shadow: 0 8px 32px rgba(0,0,0,0.14);
```

---

### 15.2 Layout System

#### Desktop Layout (≥1024px)

```text
┌─────────────────────────────────────────────────────┐
│  SIDEBAR (220px fixed)  │  MAIN CONTENT (flex-grow) │
│                         │                           │
│  Logo                   │  Header (topbar)          │
│  ──────────             │  ─────────────────────    │
│  Nav item               │  Page content             │
│  Nav item (active)      │                           │
│  Nav item               │                           │
│  ──────────             │                           │
│  Logout                 │                           │
└─────────────────────────────────────────────────────┘
```

#### Mobile Layout (<768px)

```text
┌─────────────────────────┐
│  Topbar: Logo + Hamburger│
├─────────────────────────┤
│  Page content           │
│                         │
│                         │
└─────────────────────────┘
```

Sidebar berubah menjadi drawer overlay dari sisi kiri, dengan backdrop semi-transparan saat terbuka.

---

### 15.3 Screen Specifications

#### A. Login Page (`/login` dan `/admin/login`)

**Layout:** 2 kolom di desktop (form kiri, ilustrasi kanan), 1 kolom di mobile.

**Komponen:**
- Logo + nama produk di atas form
- Input `Username` dan `Password` dengan label di atas field
- Checkbox `Ingat saya`
- Button `Login` — biru solid, full-width
- Link `Support Telegram` dengan ikon Telegram di bawah button
- Footer copyright kecil

**Ilustrasi kanan:** Gambar smartphone atau visual representasi produk — bukan stock photo generik.

**Behavior:**
- Error state: border input berubah merah + pesan error di bawah field
- Loading state: button disabled + spinner inline

---

#### B. User Dashboard (`/app/dashboard`)

**Header (topbar):**
- Greeting personalised: `Halo, [Nama] 👋`
- Ikon notifikasi bell
- Avatar + nama + username di kanan

**Stat Cards (4 kolom, 2 kolom di tablet, 1 kolom di mobile):**

| Card | Isi |
| --- | --- |
| Total Order | Angka besar + label "Semua waktu" |
| Order Aktif | Angka + label "Sedang berjalan" |
| Total Claim | Angka + label "Total pengajuan" |
| Saldo | Nilai Rp + label "Tidak ada saldo" jika kosong |

**Order Terakhir card:**
- Order ID, IMEI (sebagian di-mask), status badge, tanggal dibuat
- Button `Lihat Detail` → navigasi ke detail order

**CTA Card "Buat Order Baru":**
- Background biru brand
- Teks putih + deskripsi singkat
- Button `Order Sekarang`
- Ilustrasi kecil di kanan

**Tabel Riwayat Order Terbaru:**
- Kolom: Order ID, IMEI, Status, Tanggal
- Max 5 baris, link `Lihat Semua` ke `/app/riwayat`
- Status ditampilkan sebagai badge berwarna

---

#### C. Buat Order (`/app/order/baru`)

**Form fields:**
1. Pilih Layanan — dropdown dengan nama layanan dan harga (contoh: `Aktivasi IMEI — Rp150.000`)
2. Input IMEI — text field, validasi 15 digit angka
3. Catatan — textarea opsional

**Preview harga** tampil setelah layanan dipilih.

**Button:** `Generate QRIS` atau `Buat Order` — biru solid, full-width.

**Validation errors** ditampilkan inline di bawah masing-masing field.

---

#### D. Halaman Pembayaran (`/app/order/[id]/bayar`)

**Komponen:**
- Nama layanan + nominal `Rp150.000`
- QR Code besar di tengah (dari payment gateway atau placeholder)
- Countdown timer `MM:SS` — berubah warna ke oranye saat < 5 menit, merah saat < 1 menit
- Status badge `WAITING PAYMENT`
- Button `Saya Sudah Membayar` — secondary/outline style

**Behavior:**
- Saat countdown habis, tampilkan state expired dengan instruksi untuk buat invoice baru
- Auto-refresh status pembayaran tiap 10 detik (polling atau SSE)

---

#### E. Status Order — Stepper (`/app/order/[id]/status`)

**Stepper vertikal** dengan 5 langkah:

```text
● QRIS Dibuat          — [timestamp]
● Pembayaran Diterima  — [timestamp]
● Menunggu Admin       — [timestamp]
● Sedang Diproses      — [timestamp]
○ Selesai              — (belum)
```

**Visual step:**
- Step selesai: lingkaran hijau + ikon centang
- Step aktif: lingkaran biru solid + label bold
- Step pending: lingkaran abu-abu outline + label normal

**Timeline** di sisi kanan setiap step yang sudah selesai menampilkan waktu.

---

#### F. Detail Order (`/app/order/[id]`)

**Card detail:**
- Order ID (bold, besar)
- Layanan, IMEI, Harga, Status badge
- Tanggal dibuat + tanggal selesai (jika ada)
- Nama admin pemroses (jika sudah diambil)

**Hasil order** ditampilkan di bagian bawah card setelah status `Done`:
- `resultStatus`, `resultNote`, metadata tambahan

**Button:** `Ajukan Claim` — hanya muncul jika status `Done`.

---

#### G. Riwayat Order (`/app/riwayat`)

**Filter & search:**
- Search bar: cari berdasarkan Order ID atau IMEI
- Dropdown filter `Semua Status`
- Filter tanggal (opsional)

**Tabel:**

| Kolom | Detail |
| --- | --- |
| Order ID | Link ke detail order |
| IMEI | Sebagian di-mask: `356XXXXXXXX` |
| Status | Badge berwarna |
| Tanggal | Format `DD MMM YYYY, HH:mm` |

**Pagination:** minimal, tampilkan total data di bawah tabel.

**Empty state:** ilustrasi ringan + teks "Belum ada order. Buat order pertamamu."

---

#### H. Super Admin Dashboard (`/admin/dashboard`)

**Stat Cards (4 kolom):**

| Card | Isi |
| --- | --- |
| Total Order | Angka + tren % vs kemarin |
| Waiting Admin | Jumlah order menunggu diambil |
| In Process | Jumlah order sedang dikerjakan |
| Done | Jumlah order selesai hari ini |

**Pendapatan Hari Ini:** nominal besar + tren arrow hijau/merah.

**Grafik transaksi:** line chart harian, 7 hari terakhir (library: Recharts atau Chart.js).

**Tabel Order Terbaru:** 10 baris terbaru, kolom Order ID, User, IMEI, Status, Tanggal.

**Super Admin Sidebar Navigation:**

```text
Dashboard
Orders
Users
Admins
Services
Claims
Reports
Settings
```

---

#### I. Manajemen User (`/admin/users`)

**Tabel:**

| Kolom | Detail |
| --- | --- |
| No | Nomor urut |
| User | Nama + username |
| Telegram ID | `@handle` jika sudah link |
| Harga IMEI | Harga khusus user jika ada |
| Status | Badge Aktif / Suspended |
| Mud | Status kemudahan akses |
| Aksi | Edit (ikon biru) + Hapus (ikon merah) |

**Tombol:** `+ Tambah User` di kanan atas.

**Search** berdasarkan nama / username / Telegram ID.

---

#### J. Edit User Modal

Tampil sebagai **modal dialog** (bukan halaman baru):
- Input: Username, Password (kosong = tidak berubah), Harga IMEI, Status aktif
- Button: `Simpan` (biru) + `Batal` (ghost/outline)

---

#### K. Manajemen Order Super Admin (`/admin/orders`)

**Filter bar:**
- Dropdown `Semua Status`
- Date picker
- Search `Cari Order ID atau IMEI...`
- Button `Export` di kanan

**Tabel:**

| Kolom | Detail |
| --- | --- |
| Order ID | Kode unik |
| User | Nama user |
| IMEI | Sebagian di-mask |
| Harga | Nominal Rp |
| Status | Badge berwarna |
| Dibuat | Tanggal |
| Aksi | Ikon detail / override status |

**Pagination:** `< 1 2 3 ... >` dengan info total data.

---

### 15.4 Component Library

#### Button Variants

```text
Primary   → bg-primary text-white                  (aksi utama)
Secondary → border-primary text-primary bg-white   (aksi sekunder)
Danger    → bg-red-500 text-white                  (hapus, tolak)
Ghost     → text-secondary bg-transparent          (aksi ringan)
```

Semua button: `transform: scale(0.97)` on `:active` — feedback press terasa responsif.

#### Input Field

- Label selalu di atas field (bukan placeholder-as-label)
- Border default: `#E2E8F0`
- Focus ring: `ring-2 ring-primary/30 border-primary`
- Error state: `border-red-400` + pesan error merah di bawah
- Disabled: `bg-surface-secondary opacity-60`

#### Status Badge

```css
.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  border: 1px solid;
}
```

#### Table

- Header: `bg-surface-secondary`, font weight 600, font-size 12px uppercase
- Row hover: `bg-primary-light/40`
- Border: hanya `border-bottom` per row, tidak ada border kiri/kanan
- Padding cell: `12px 16px`

#### Sidebar Navigation

- Item default: `text-text-secondary`, no background
- Item hover: `bg-surface-secondary text-text-primary`
- Item aktif: `bg-primary-light text-primary font-semibold` + border kiri `3px solid primary`
- Ikon: 18px, monochrome, sejajar dengan label

---

### 15.5 Micro-Interactions & Animation

Mengacu pada panduan **emil-design-eng** skill.

#### Status Badge Transition

Saat status order berubah (polling/SSE), badge lama fade-out lalu badge baru fade-in:

```css
.badge {
  transition: opacity 200ms ease-out, background-color 300ms ease-out;
}
```

Jangan gunakan animasi jika perubahan dipicu keyboard action.

#### Countdown Timer

- Angka berubah dengan `translateY` kecil (8px) + opacity:
```css
transition: transform 150ms ease-out, opacity 150ms ease-out;
```
- Warna timer berubah: default `text-primary` → `#F59E0B` (< 5 menit) → `#EF4444` (< 1 menit)

#### Stepper Progress

Saat step baru selesai, lingkaran abu-abu berubah ke hijau dengan:
- Scale dari `0.8` ke `1.0`
- Opacity dari `0` ke `1`
- Duration: `300ms ease-out`

#### Sidebar Drawer (Mobile)

```css
.drawer {
  transform: translateX(-100%);
  transition: transform 280ms cubic-bezier(0.32, 0.72, 0, 1); /* ease-drawer */
}
.drawer.open {
  transform: translateX(0);
}
```

Backdrop: `opacity: 0` → `opacity: 0.4` dengan `transition: opacity 280ms ease-out`.

#### Modal Dialog

- Enter: `scale(0.95) opacity(0)` → `scale(1) opacity(1)`, `200ms ease-out`
- Exit: `200ms ease-in`, lebih cepat dari enter
- `transform-origin: center` (modal tidak anchor ke trigger)

#### Toast / Notifikasi

```css
.toast {
  transition: transform 400ms ease, opacity 400ms ease;
  @starting-style {
    opacity: 0;
    transform: translateY(100%);
  }
}
```

Gunakan `ease` (bukan `ease-out`) untuk toast agar terasa lebih elegan dan tidak terburu-buru.

#### Button Press

```css
.button {
  transition: transform 160ms ease-out, background-color 150ms ease;
}
.button:active {
  transform: scale(0.97);
}
```

---

### 15.6 Responsive Breakpoints

| Breakpoint | Width | Layout perubahan |
| --- | --- | --- |
| `sm` | 640px | — |
| `md` | 768px | Sidebar collapse ke drawer, tabel scroll horizontal |
| `lg` | 1024px | Layout penuh sidebar + main content |
| `xl` | 1280px | Padding lebih lebar, stat card 4 kolom |

**Tabel di mobile:** scroll horizontal (`overflow-x: auto`) dengan shadow indikator di tepi kanan.

**Stat cards:**
- Desktop: 4 kolom
- Tablet: 2 kolom
- Mobile: 1 kolom

---

### 15.7 Empty States

Setiap halaman dengan daftar data harus memiliki empty state yang jelas:

| Halaman | Pesan | CTA |
| --- | --- | --- |
| Riwayat Order | "Belum ada order. Mulai buat order pertamamu." | Button `Buat Order` |
| Manajemen User | "Belum ada user terdaftar." | Button `+ Tambah User` |
| Manajemen Order (admin) | "Tidak ada order sesuai filter." | Button `Reset Filter` |
| Dashboard stat 0 | Tampilkan `0` tanpa error, label tetap konsisten | — |

---

### 15.8 Loading States

| Komponen | Loading pattern |
| --- | --- |
| Tabel data | Skeleton rows (3–5 baris abu-abu animasi pulse) |
| Stat cards | Skeleton rectangle sesuai ukuran angka |
| QR Code | Spinner lingkaran di tengah area QR |
| Button submit | Spinner inline + label "Memproses..." + disabled |
| Halaman pertama kali | Skeleton layout penuh, bukan blank white |

---

### 15.9 Accessibility Baseline

- Semua form input memiliki `<label>` eksplisit (bukan hanya placeholder)
- Focus ring selalu terlihat: `ring-2 ring-primary/50` — jangan dihilangkan
- Status badge memiliki teks, bukan hanya warna
- Animasi mematuhi `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

- Hover animation hanya pada perangkat yang mendukung hover:

```css
@media (hover: hover) and (pointer: fine) {
  .card:hover { ... }
}
```

- Kontras warna minimum WCAG AA: rasio 4.5:1 untuk teks normal, 3:1 untuk teks besar.

---

### 15.10 Design Checklist (Pre-implementation)

Jalankan `/impeccable audit` setelah setiap halaman selesai dibangun. Checklist manual:

- [ ] Semua status badge menggunakan token warna yang konsisten
- [ ] Tidak ada font `Inter` digunakan sebagai satu-satunya pilihan tanpa pertimbangan alternatif
- [ ] Tidak ada teks abu-abu di atas background berwarna
- [ ] Tidak ada `border-radius` yang terlalu besar (>16px untuk card konten)
- [ ] Tabel memiliki empty state dan loading state
- [ ] Semua button memiliki `:active` scale feedback
- [ ] Countdown timer memiliki perubahan warna saat mendekati expired
- [ ] Sidebar navigation menunjukkan halaman aktif dengan jelas
- [ ] Mobile layout tidak ada elemen yang terpotong atau overflow tersembunyi
- [ ] Semua animasi berdurasi < 300ms kecuali ada alasan deliberat
