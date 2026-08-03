# ZITTOSITE Reports API — Design

**Date:** 2026-08-03  
**Status:** Approved (rekomendasi A)  
**Depends on:** Order foundation, Admin auth, Super Admin orders/users

## Goal

Halaman `/admin/reports` memakai agregasi Postgres nyata (KPI, chart 7 hari, status, kinerja admin, layanan).

## Scope

### In

- `GET /admin/reports/summary` (`AdminAuthGuard` — semua admin login)
- Wire `/admin/reports` ke API
- Pendapatan = sum `PaymentInvoice.amount` where `paymentStatus = paid`
- Window 7 hari + “hari ini” dalam timezone `Asia/Jakarta`
- Hapus fake trend “12%” pada KPI pendapatan hari ini

### Out

- Date-range picker / export CSV
- SuperAdmin-only gate
- QRIS gateway

## Response shape

```ts
{
  kpis: {
    revenueTotal: number;
    revenueToday: number;
    ordersToday: number;
    usersTotal: number;
    usersActive: number;
    ordersDone: number;
    waitingAction: number;
  };
  channelMix: { label: string; value: number }[];      // last 7d by Order.channel
  weeklyBars: { day: string; orders: number }[];       // last 7d createdAt
  revenueSeries: { date: string; amount: number }[];   // last 7d paidAt
  serviceMix: { label: string; value: number }[];      // all-time paid via order.service
  byStatus: { status: OrderStatus; count: number }[];
  adminPerformance: {
    fullName: string;
    telegramHandle: string | null;
    handledCount: number;
  }[];
  services: {
    id: string;
    name: string;
    active: boolean;
    estimate: string;
    price: number;
  }[];
}
```

## Success criteria

1. Reports page loads without mock-data imports
2. Creating/paying an order changes revenue / charts after refresh
3. Operator `admin` (bukan super_admin) dapat membuka Reports
