import { ApiError } from "@/lib/api-error";
import {
  admins,
  findOrder,
  getAdminStats,
  getChannelMix,
  getCurrentUser,
  getRevenueSeries,
  getServiceMix,
  getWeeklyOrderBars,
  listOrders,
  listUserOrders,
  services,
  users,
} from "@/lib/mock-data";
import type { MockAudience } from "@/lib/mock-mode";
import type { OrderStatus } from "@/lib/types";

function unauthorized(): never {
  throw new ApiError("Unauthorized", 401);
}

function methodOf(init?: RequestInit): string {
  return (init?.method ?? "GET").toUpperCase();
}

function pathOnly(path: string): string {
  return path.split("?")[0] ?? path;
}

function mockAdmin() {
  return {
    id: "adm-mock-super",
    username: "superadmin",
    fullName: "Pusdatik Admin (Demo)",
    role: "super_admin" as const,
    telegramHandle: null,
    active: true,
    handledCount: 0,
    totpEnabled: false,
  };
}

function reportsSummary() {
  const stats = getAdminStats();
  const all = listOrders();
  const byStatusMap = new Map<OrderStatus, number>();
  for (const order of all) {
    byStatusMap.set(order.status, (byStatusMap.get(order.status) ?? 0) + 1);
  }

  return {
    kpis: {
      revenueTotal: all
        .filter((o) => o.status !== "waiting_payment" && o.status !== "cancel")
        .reduce((sum, o) => sum + o.price, 0),
      revenueToday: stats.revenueToday,
      ordersToday: stats.ordersToday,
      usersTotal: users.length,
      usersActive: users.filter((u) => u.status === "active").length,
      ordersDone: stats.done,
      waitingAction: stats.waitingAction,
    },
    channelMix: getChannelMix(),
    weeklyBars: getWeeklyOrderBars(),
    revenueSeries: getRevenueSeries(),
    serviceMix: getServiceMix(),
    byStatus: [...byStatusMap.entries()].map(([status, count]) => ({
      status,
      count,
    })),
    adminPerformance: admins.map((a) => ({
      id: a.id,
      fullName: a.fullName,
      telegramHandle: a.telegramHandle,
      handledCount: a.handledCount,
    })),
    services: services.map((s) => ({
      id: s.id,
      name: s.name,
      active: s.active,
      estimate: s.estimate,
      price: s.price,
    })),
  };
}

/**
 * In-process mock Nest API for Vercel demo builds (`NEXT_PUBLIC_USE_MOCK=1`).
 * Any username/password works; session is a cookie set by the client api layer.
 */
export async function mockApi<T>(
  path: string,
  init: RequestInit | undefined,
  audience: MockAudience | null,
): Promise<T> {
  const method = methodOf(init);
  const p = pathOnly(path);

  if (method === "POST" && p === "/auth/login") {
    return {
      user: getCurrentUser(),
    } as T;
  }

  if (method === "POST" && p === "/admin/auth/login") {
    return {
      requiresTotp: false,
      admin: mockAdmin(),
    } as T;
  }

  if (method === "POST" && (p === "/auth/logout" || p === "/admin/auth/logout")) {
    return undefined as T;
  }

  if (method === "GET" && p === "/me") {
    if (audience !== "user") unauthorized();
    return getCurrentUser() as T;
  }

  if (method === "GET" && p === "/admin/me") {
    if (audience !== "admin") unauthorized();
    return mockAdmin() as T;
  }

  if (method === "GET" && p === "/orders") {
    if (audience !== "user") unauthorized();
    return listUserOrders() as T;
  }

  if (method === "GET" && p.startsWith("/orders/")) {
    if (audience !== "user") unauthorized();
    const orderId = p.slice("/orders/".length).split("/")[0]!;
    const order = findOrder(orderId);
    if (!order) throw new ApiError("Order tidak ditemukan", 404);
    return order as T;
  }

  if (method === "GET" && p === "/services") {
    if (audience !== "user") unauthorized();
    return services.filter((s) => s.active) as T;
  }

  if (method === "GET" && p === "/admin/dashboard/stats") {
    if (audience !== "admin") unauthorized();
    const stats = getAdminStats();
    return {
      ...stats,
      activeServices: services.filter((s) => s.active).length,
      recentOrders: listOrders().slice(0, 8),
    } as T;
  }

  if (method === "GET" && p === "/admin/reports/summary") {
    if (audience !== "admin") unauthorized();
    return reportsSummary() as T;
  }

  if (method === "GET" && p === "/admin/users") {
    if (audience !== "admin") unauthorized();
    return users as T;
  }

  if (method === "GET" && p === "/admin/services") {
    if (audience !== "admin") unauthorized();
    return services as T;
  }

  if (method === "GET" && p === "/admin/admins") {
    if (audience !== "admin") unauthorized();
    return admins.map((a, i) => ({
      ...a,
      role: i === 0 ? ("super_admin" as const) : ("admin" as const),
    })) as T;
  }

  if (method === "GET" && (p === "/admin/orders" || p.startsWith("/admin/orders?"))) {
    if (audience !== "admin") unauthorized();
    return listOrders() as T;
  }

  if (method === "GET" && p.startsWith("/admin/orders/")) {
    if (audience !== "admin") unauthorized();
    const orderId = p.slice("/admin/orders/".length).split("/")[0]!;
    const order = findOrder(orderId);
    if (!order) throw new ApiError("Order tidak ditemukan", 404);
    return order as T;
  }

  if (method === "GET" && p === "/me/telegram/status") {
    if (audience !== "user") unauthorized();
    return { linked: false, telegramHandle: null } as T;
  }

  if (method === "GET" && p === "/admin/settings/telegram") {
    if (audience !== "admin") unauthorized();
    return { linked: false, telegramHandle: null } as T;
  }

  if (method === "GET" && p === "/admin/me/totp") {
    if (audience !== "admin") unauthorized();
    return { enabled: false } as T;
  }

  // Mutations / other endpoints: succeed no-op for demo navigation
  if (method !== "GET") {
    if (!audience) unauthorized();
    return {} as T;
  }

  throw new ApiError(`Mock belum mendukung ${method} ${p}`, 404);
}
