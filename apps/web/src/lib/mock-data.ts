/**
 * SYNTHETIC DEMONSTRATION DATA.
 *
 * Every user, order, amount, and result below is authored for the prototype.
 * None of it is real customer data, and the QRIS payload is a placeholder —
 * no payment gateway is wired up yet (see PRODUCT.md → Capabilities and
 * Constraints). Replace this module with the NestJS API client; the exported
 * shapes are the contract, so no component needs to change.
 */

import type {
  Admin,
  Order,
  OrderActivityLog,
  OrderDetail,
  OrderResult,
  PaymentInvoice,
  Service,
  User,
} from "./types";

/** Fixed clock so historical timestamps render identically on server and client. */
const REFERENCE_NOW = new Date("2026-07-29T15:30:00+07:00");

function at(daysAgo: number, hour: number, minute: number): string {
  const d = new Date(REFERENCE_NOW);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/* ------------------------------------------------------------------ */
/* Services                                                            */
/* ------------------------------------------------------------------ */

export const services: Service[] = [
  {
    id: "svc-activation",
    name: "Aktivasi IMEI",
    description:
      "Mendaftarkan IMEI perangkat agar dapat digunakan pada jaringan seluler dalam negeri.",
    price: 150_000,
    estimate: "1–3 jam",
    active: true,
  },
  {
    id: "svc-register",
    name: "Registrasi IMEI Baru",
    description:
      "Pendaftaran perangkat yang belum pernah tercatat, termasuk pengecekan kelayakan.",
    price: 185_000,
    estimate: "2–6 jam",
    active: true,
  },
  {
    id: "svc-check",
    name: "Cek Status IMEI",
    description:
      "Pemeriksaan status pendaftaran perangkat tanpa mengubah data apa pun.",
    price: 35_000,
    estimate: "±15 menit",
    active: true,
  },
  {
    id: "svc-unlock",
    name: "Buka Blokir IMEI",
    description:
      "Pengajuan pembukaan blokir untuk perangkat yang sudah tercatat namun terkunci.",
    price: 275_000,
    estimate: "1–2 hari kerja",
    active: false,
  },
];

/* ------------------------------------------------------------------ */
/* People                                                              */
/* ------------------------------------------------------------------ */

export const users: User[] = [
  {
    id: "usr-fajri",
    username: "fajri",
    fullName: "Muhammad Al Fajri",
    telegramHandle: "@alfajri",
    customPrice: null,
    status: "active",
    botAccess: true,
    createdAt: at(96, 9, 12),
  },
  {
    id: "usr-aminah",
    username: "siti.aminah",
    fullName: "Siti Aminah",
    telegramHandle: "@sitiaminah",
    customPrice: 170_000,
    status: "active",
    botAccess: true,
    createdAt: at(88, 14, 3),
  },
  {
    id: "usr-agus",
    username: "agus123",
    fullName: "Agus Setiawan",
    telegramHandle: "@agussetiawan",
    customPrice: null,
    status: "active",
    botAccess: true,
    createdAt: at(74, 10, 45),
  },
  {
    id: "usr-budi",
    username: "budi99",
    fullName: "Budi Hartono",
    telegramHandle: null,
    customPrice: null,
    status: "suspended",
    botAccess: false,
    createdAt: at(70, 16, 20),
  },
  {
    id: "usr-rahmat",
    username: "rahmat",
    fullName: "Rahmat Hidayat",
    telegramHandle: "@rahmath",
    customPrice: 140_000,
    status: "active",
    botAccess: true,
    createdAt: at(61, 8, 30),
  },
  {
    id: "usr-dewi",
    username: "dewi.lestari",
    fullName: "Dewi Lestari",
    telegramHandle: "@dewilestari",
    customPrice: null,
    status: "active",
    botAccess: true,
    createdAt: at(52, 11, 5),
  },
  {
    id: "usr-hendra",
    username: "hendra.p",
    fullName: "Hendra Pratama",
    telegramHandle: "@hendrap",
    customPrice: null,
    status: "active",
    botAccess: true,
    createdAt: at(41, 13, 40),
  },
  {
    id: "usr-nurul",
    username: "nurul.aini",
    fullName: "Nurul Aini",
    telegramHandle: null,
    customPrice: null,
    status: "active",
    botAccess: false,
    createdAt: at(33, 9, 55),
  },
  {
    id: "usr-yusuf",
    username: "yusuf.maulana",
    fullName: "Yusuf Maulana",
    telegramHandle: "@yusufm",
    customPrice: 160_000,
    status: "active",
    botAccess: true,
    createdAt: at(24, 15, 15),
  },
  {
    id: "usr-intan",
    username: "intan.p",
    fullName: "Intan Permatasari",
    telegramHandle: "@intanp",
    customPrice: null,
    status: "active",
    botAccess: true,
    createdAt: at(17, 10, 25),
  },
  {
    id: "usr-galih",
    username: "galih.w",
    fullName: "Galih Wicaksono",
    telegramHandle: "@galihw",
    customPrice: null,
    status: "active",
    botAccess: true,
    createdAt: at(9, 12, 0),
  },
  {
    id: "usr-sari",
    username: "sari.mulyani",
    fullName: "Sari Mulyani",
    telegramHandle: null,
    customPrice: null,
    status: "suspended",
    botAccess: false,
    createdAt: at(4, 17, 45),
  },
];

export const admins: Admin[] = [
  {
    id: "adm-ridwan",
    username: "ridwan",
    fullName: "Ridwan Saputra",
    telegramHandle: "@ridwansaputra",
    active: true,
    handledCount: 142,
  },
  {
    id: "adm-lina",
    username: "lina",
    fullName: "Lina Marlina",
    telegramHandle: "@linamarlina",
    active: true,
    handledCount: 118,
  },
  {
    id: "adm-teguh",
    username: "teguh",
    fullName: "Teguh Prasetyo",
    telegramHandle: "@teguhpras",
    active: true,
    handledCount: 87,
  },
  {
    id: "adm-wulan",
    username: "wulan",
    fullName: "Wulan Safitri",
    telegramHandle: "@wulansafitri",
    active: false,
    handledCount: 39,
  },
];

/* ------------------------------------------------------------------ */
/* Orders                                                              */
/* ------------------------------------------------------------------ */

interface OrderSeed {
  seq: number;
  dayOffset: number;
  hour: number;
  minute: number;
  userId: string;
  serviceId: string;
  channel: Order["channel"];
  imei: string;
  status: Order["status"];
  adminId?: string;
  notes?: string;
}

const orderSeeds: OrderSeed[] = [
  // Today — the live queue
  { seq: 15, dayOffset: 0, hour: 14, minute: 20, userId: "usr-fajri", serviceId: "svc-activation", channel: "web", imei: "356938035643809", status: "in_process", adminId: "adm-ridwan", notes: "Perangkat baru dari luar negeri." },
  { seq: 14, dayOffset: 0, hour: 13, minute: 5, userId: "usr-fajri", serviceId: "svc-check", channel: "telegram", imei: "354827091223418", status: "waiting_action" },
  { seq: 13, dayOffset: 0, hour: 11, minute: 48, userId: "usr-dewi", serviceId: "svc-activation", channel: "web", imei: "351902447718203", status: "waiting_action" },
  { seq: 12, dayOffset: 0, hour: 10, minute: 32, userId: "usr-agus", serviceId: "svc-register", channel: "telegram", imei: "359471028834112", status: "in_process", adminId: "adm-lina" },
  { seq: 11, dayOffset: 0, hour: 9, minute: 58, userId: "usr-galih", serviceId: "svc-activation", channel: "web", imei: "358120669043277", status: "waiting_payment", notes: "Mohon diproses hari ini." },
  { seq: 10, dayOffset: 0, hour: 9, minute: 14, userId: "usr-intan", serviceId: "svc-check", channel: "web", imei: "353017118820964", status: "paid" },
  { seq: 9, dayOffset: 0, hour: 8, minute: 40, userId: "usr-rahmat", serviceId: "svc-activation", channel: "telegram", imei: "352644900137285", status: "done", adminId: "adm-ridwan" },
  { seq: 8, dayOffset: 0, hour: 8, minute: 5, userId: "usr-aminah", serviceId: "svc-register", channel: "web", imei: "357288451190673", status: "done", adminId: "adm-teguh" },

  // Yesterday
  { seq: 7, dayOffset: 1, hour: 16, minute: 45, userId: "usr-hendra", serviceId: "svc-activation", channel: "web", imei: "350991276604518", status: "done", adminId: "adm-lina" },
  { seq: 6, dayOffset: 1, hour: 15, minute: 22, userId: "usr-yusuf", serviceId: "svc-activation", channel: "telegram", imei: "356710338925447", status: "done", adminId: "adm-ridwan" },
  { seq: 5, dayOffset: 1, hour: 13, minute: 10, userId: "usr-nurul", serviceId: "svc-check", channel: "web", imei: "354192887730165", status: "rejected", adminId: "adm-teguh", notes: "IMEI tidak terbaca pada dokumen." },
  { seq: 4, dayOffset: 1, hour: 11, minute: 30, userId: "usr-fajri", serviceId: "svc-activation", channel: "web", imei: "358443019962704", status: "done", adminId: "adm-lina" },
  { seq: 3, dayOffset: 1, hour: 10, minute: 8, userId: "usr-dewi", serviceId: "svc-register", channel: "web", imei: "351776204418839", status: "done", adminId: "adm-ridwan" },
  { seq: 2, dayOffset: 1, hour: 9, minute: 25, userId: "usr-sari", serviceId: "svc-activation", channel: "web", imei: "359028114476592", status: "cancel" },
  { seq: 1, dayOffset: 1, hour: 8, minute: 50, userId: "usr-agus", serviceId: "svc-activation", channel: "telegram", imei: "352901663087214", status: "done", adminId: "adm-teguh" },

  // Earlier this week
  { seq: 22, dayOffset: 2, hour: 15, minute: 40, userId: "usr-fajri", serviceId: "svc-check", channel: "web", imei: "356104778290361", status: "done", adminId: "adm-ridwan" },
  { seq: 21, dayOffset: 2, hour: 12, minute: 18, userId: "usr-intan", serviceId: "svc-activation", channel: "web", imei: "353886201194570", status: "done", adminId: "adm-lina" },
  { seq: 20, dayOffset: 2, hour: 10, minute: 2, userId: "usr-rahmat", serviceId: "svc-register", channel: "telegram", imei: "357449930025186", status: "done", adminId: "adm-teguh" },
  { seq: 19, dayOffset: 3, hour: 16, minute: 12, userId: "usr-hendra", serviceId: "svc-activation", channel: "web", imei: "350612884471903", status: "done", adminId: "adm-ridwan" },
  { seq: 18, dayOffset: 3, hour: 11, minute: 55, userId: "usr-fajri", serviceId: "svc-activation", channel: "web", imei: "358907213366428", status: "done", adminId: "adm-lina" },
  { seq: 17, dayOffset: 4, hour: 14, minute: 33, userId: "usr-yusuf", serviceId: "svc-check", channel: "web", imei: "354260119847735", status: "done", adminId: "adm-teguh" },
  { seq: 16, dayOffset: 4, hour: 9, minute: 47, userId: "usr-aminah", serviceId: "svc-activation", channel: "telegram", imei: "351338670092514", status: "done", adminId: "adm-ridwan" },
  { seq: 25, dayOffset: 5, hour: 13, minute: 20, userId: "usr-galih", serviceId: "svc-activation", channel: "web", imei: "359115447726083", status: "done", adminId: "adm-lina" },
  { seq: 24, dayOffset: 5, hour: 10, minute: 9, userId: "usr-dewi", serviceId: "svc-check", channel: "web", imei: "352773008861249", status: "done", adminId: "adm-teguh" },
  { seq: 23, dayOffset: 6, hour: 15, minute: 5, userId: "usr-fajri", serviceId: "svc-register", channel: "web", imei: "356820994013762", status: "done", adminId: "adm-ridwan" },
  { seq: 26, dayOffset: 6, hour: 11, minute: 41, userId: "usr-nurul", serviceId: "svc-activation", channel: "web", imei: "353694102258417", status: "done", adminId: "adm-lina" },
];

function buildOrderId(dayOffset: number, seq: number): string {
  const d = new Date(REFERENCE_NOW);
  d.setDate(d.getDate() - dayOffset);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `ZT${yy}${mm}${dd}${String(seq).padStart(4, "0")}`;
}

function priceFor(userId: string, serviceId: string): number {
  const service = services.find((s) => s.id === serviceId)!;
  const user = users.find((u) => u.id === userId)!;
  // A per-user negotiated price only overrides the flagship activation service.
  if (user.customPrice !== null && serviceId === "svc-activation") {
    return user.customPrice;
  }
  return service.price;
}

export const orders: Order[] = orderSeeds.map((seed) => {
  const createdAt = at(seed.dayOffset, seed.hour, seed.minute);
  const created = new Date(createdAt);

  const startedAt =
    seed.status === "in_process" ||
    seed.status === "done" ||
    seed.status === "rejected"
      ? new Date(created.getTime() + 22 * 60_000).toISOString()
      : null;

  const completedAt =
    seed.status === "done" || seed.status === "rejected"
      ? new Date(created.getTime() + 96 * 60_000).toISOString()
      : null;

  return {
    id: `ord-${seed.seq}-${seed.dayOffset}`,
    orderId: buildOrderId(seed.dayOffset, seed.seq),
    userId: seed.userId,
    serviceId: seed.serviceId,
    channel: seed.channel,
    imei: seed.imei,
    notes: seed.notes ?? null,
    status: seed.status,
    price: priceFor(seed.userId, seed.serviceId),
    assignedAdminId: seed.adminId ?? null,
    startedAt,
    completedAt,
    createdAt,
    updatedAt: completedAt ?? startedAt ?? createdAt,
  };
});

/* ------------------------------------------------------------------ */
/* Invoices                                                            */
/* ------------------------------------------------------------------ */

/**
 * The one still-payable invoice expires relative to real time so the
 * countdown is demonstrable. Everything else has a settled timestamp.
 */
const LIVE_INVOICE_WINDOW_MS = 29 * 60_000 + 55_000;

export const invoices: PaymentInvoice[] = orders
  .filter((order) => order.status !== "cancel" || true)
  .map((order) => {
    const created = new Date(order.createdAt);
    const settled =
      order.status !== "waiting_payment" && order.status !== "cancel";

    return {
      invoiceId: `INV-${order.orderId.slice(2)}`,
      orderId: order.orderId,
      amount: order.price,
      paymentChannel: "QRIS",
      paymentReference: settled ? `QR${order.orderId.slice(-8)}` : null,
      paymentStatus:
        order.status === "cancel"
          ? "expired"
          : order.status === "waiting_payment"
            ? "pending"
            : "paid",
      expiredAt:
        order.status === "waiting_payment"
          ? new Date(Date.now() + LIVE_INVOICE_WINDOW_MS).toISOString()
          : new Date(created.getTime() + 30 * 60_000).toISOString(),
      paidAt: settled
        ? new Date(created.getTime() + 6 * 60_000).toISOString()
        : null,
    };
  });

/* ------------------------------------------------------------------ */
/* Results                                                             */
/* ------------------------------------------------------------------ */

const resultNotes: Record<string, { note: string; status: OrderResult["resultStatus"] }> = {
  default: {
    status: "success",
    note: "IMEI berhasil terdaftar dan sudah aktif pada jaringan. Silakan restart perangkat, lalu pasang kembali kartu SIM.",
  },
  partial: {
    status: "partial",
    note: "Slot IMEI pertama berhasil didaftarkan. Slot kedua memerlukan dokumen tambahan, silakan ajukan ulang untuk slot tersisa.",
  },
  rejected: {
    status: "failed",
    note: "IMEI pada dokumen tidak sesuai dengan yang dikirim. Order ditolak, silakan buat order baru dengan data yang benar.",
  },
};

export const orderResults: OrderResult[] = orders
  .filter((order) => order.status === "done" || order.status === "rejected")
  .map((order, index) => {
    const preset =
      order.status === "rejected"
        ? resultNotes.rejected
        : index % 9 === 4
          ? resultNotes.partial
          : resultNotes.default;

    return {
      id: `res-${order.orderId}`,
      orderId: order.orderId,
      resultStatus: preset.status,
      resultNote: preset.note,
      resultData:
        order.status === "done"
          ? {
              "Operator terverifikasi": "Telkomsel, Indosat, XL, Tri",
              "Berlaku sejak": "Segera setelah restart perangkat",
            }
          : null,
      createdByAdminId: order.assignedAdminId ?? "adm-ridwan",
      createdAt: order.completedAt ?? order.updatedAt,
    };
  });

/* ------------------------------------------------------------------ */
/* Activity log                                                        */
/* ------------------------------------------------------------------ */

export const activityLogs: OrderActivityLog[] = orders.flatMap((order) => {
  const logs: OrderActivityLog[] = [];
  const created = new Date(order.createdAt);
  const push = (
    status: Order["status"],
    note: string,
    actor: string,
    offsetMinutes: number,
  ) => {
    logs.push({
      id: `log-${order.orderId}-${logs.length}`,
      orderId: order.orderId,
      status,
      note,
      actor,
      createdAt: new Date(created.getTime() + offsetMinutes * 60_000).toISOString(),
    });
  };

  const user = users.find((u) => u.id === order.userId)!;
  const admin = admins.find((a) => a.id === order.assignedAdminId);
  const viaLabel = order.channel === "telegram" ? "Telegram" : "website";

  push("waiting_payment", `Order dibuat lewat ${viaLabel}. Invoice QRIS diterbitkan.`, user.fullName, 0);

  if (order.status === "cancel") {
    push("cancel", "Batas waktu pembayaran terlewat, order dibatalkan otomatis.", "Sistem", 30);
    return logs;
  }

  if (order.status === "waiting_payment") return logs;

  push("paid", "Pembayaran diterima dan diverifikasi.", "Sistem", 6);

  if (order.status === "paid") return logs;

  push("waiting_action", "Order masuk antrean dan disiarkan ke admin.", "Sistem", 7);

  if (order.status === "waiting_action") return logs;

  push("in_process", `Order diambil oleh ${admin?.fullName ?? "admin"}.`, admin?.fullName ?? "Admin", 22);

  if (order.status === "in_process") return logs;

  if (order.status === "rejected") {
    push("rejected", "Order ditolak karena data IMEI tidak sesuai dokumen.", admin?.fullName ?? "Admin", 96);
    return logs;
  }

  push("done", "Hasil pengerjaan dikirim ke user.", admin?.fullName ?? "Admin", 96);
  return logs;
});

/* ------------------------------------------------------------------ */
/* Queries — the shape the real API client will expose                 */
/* ------------------------------------------------------------------ */

/** The signed-in demo user for the `/app` portal. */
export const CURRENT_USER_ID = "usr-fajri";

export function getCurrentUser(): User {
  return users.find((u) => u.id === CURRENT_USER_ID)!;
}

export function getService(serviceId: string): Service {
  return services.find((s) => s.id === serviceId)!;
}

export function getUser(userId: string): User {
  return users.find((u) => u.id === userId)!;
}

export function getAdmin(adminId: string | null): Admin | null {
  if (!adminId) return null;
  return admins.find((a) => a.id === adminId) ?? null;
}

export function getInvoice(orderId: string): PaymentInvoice | null {
  return invoices.find((i) => i.orderId === orderId) ?? null;
}

export function getResult(orderId: string): OrderResult | null {
  return orderResults.find((r) => r.orderId === orderId) ?? null;
}

export function getActivity(orderId: string): OrderActivityLog[] {
  return activityLogs
    .filter((log) => log.orderId === orderId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function toDetail(order: Order): OrderDetail {
  return {
    ...order,
    service: getService(order.serviceId),
    user: getUser(order.userId),
    assignedAdmin: getAdmin(order.assignedAdminId),
    invoice: getInvoice(order.orderId),
    result: getResult(order.orderId),
    activity: getActivity(order.orderId),
  };
}

const byNewest = (a: Order, b: Order) => b.createdAt.localeCompare(a.createdAt);

export function listOrders(): OrderDetail[] {
  return [...orders].sort(byNewest).map(toDetail);
}

export function listUserOrders(userId = CURRENT_USER_ID): OrderDetail[] {
  return orders
    .filter((order) => order.userId === userId)
    .sort(byNewest)
    .map(toDetail);
}

export function findOrder(orderId: string): OrderDetail | null {
  const order = orders.find((o) => o.orderId === orderId);
  return order ? toDetail(order) : null;
}

/** The order whose invoice is still payable — the payment screen's subject. */
export function findPayableOrder(userId = CURRENT_USER_ID): OrderDetail | null {
  const order = orders
    .filter((o) => o.userId === userId && o.status === "waiting_payment")
    .sort(byNewest)[0];
  return order ? toDetail(order) : null;
}

export function getUserStats(userId = CURRENT_USER_ID) {
  const own = orders.filter((o) => o.userId === userId);
  const active = own.filter((o) =>
    ["waiting_payment", "paid", "waiting_action", "in_process"].includes(o.status),
  );
  return {
    totalOrders: own.length,
    activeOrders: active.length,
    doneOrders: own.filter((o) => o.status === "done").length,
    balance: 0,
  };
}

export function getAdminStats() {
  const today = orders.filter(
    (o) => new Date(o.createdAt).toDateString() === REFERENCE_NOW.toDateString(),
  );
  const revenueToday = today
    .filter((o) => o.status !== "waiting_payment" && o.status !== "cancel")
    .reduce((sum, o) => sum + o.price, 0);

  return {
    totalOrders: orders.length,
    waitingAction: orders.filter((o) => o.status === "waiting_action").length,
    inProcess: orders.filter((o) => o.status === "in_process").length,
    done: orders.filter((o) => o.status === "done").length,
    totalUsers: users.length,
    totalAdmins: admins.filter((a) => a.active).length,
    revenueToday,
    ordersToday: today.length,
  };
}

/** Seven-day revenue series for the Super Admin chart. */
export function getRevenueSeries(): { label: string; revenue: number; orders: number }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const offset = 6 - i;
    const day = new Date(REFERENCE_NOW);
    day.setDate(day.getDate() - offset);
    const dayOrders = orders.filter(
      (o) => new Date(o.createdAt).toDateString() === day.toDateString(),
    );
    return {
      label: day.toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
      revenue: dayOrders
        .filter((o) => o.status !== "waiting_payment" && o.status !== "cancel")
        .reduce((sum, o) => sum + o.price, 0),
      orders: dayOrders.length,
    };
  });
}

/** Order volume by channel — donut chart on Reports. */
export function getChannelMix(): { name: string; amount: number; color: string }[] {
  const web = orders.filter((o) => o.channel === "web").length;
  const telegram = orders.filter((o) => o.channel === "telegram").length;
  return [
    { name: "Website", amount: web, color: "#2563EB" },
    { name: "Telegram", amount: telegram, color: "#18BFFF" },
  ].filter((item) => item.amount > 0);
}

/** Compact weekday labels for campaign-style bar chart. */
export function getWeeklyOrderBars(): { label: string; orders: number }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const offset = 6 - i;
    const day = new Date(REFERENCE_NOW);
    day.setDate(day.getDate() - offset);
    const dayOrders = orders.filter(
      (o) => new Date(o.createdAt).toDateString() === day.toDateString(),
    );
    return {
      label: day.toLocaleDateString("id-ID", { weekday: "narrow" }),
      orders: dayOrders.length,
    };
  });
}

/** Orders grouped by service — secondary donut. */
export function getServiceMix(): { name: string; amount: number; color: string }[] {
  const palette = ["#2563EB", "#1D4ED8", "#18BFFF", "#93C5FD", "#BFDBFE"];
  return services
    .map((service, index) => ({
      name: service.name,
      amount: orders.filter((o) => o.serviceId === service.id).length,
      color: palette[index % palette.length]!,
    }))
    .filter((item) => item.amount > 0);
}

/** Placeholder QRIS payload. Not a real merchant string. */
export function buildQrisPayload(orderId: string, amount: number): string {
  return `ZITTOSITE-DEMO|${orderId}|IDR${amount}|NOT-A-REAL-QRIS-PAYLOAD`;
}
