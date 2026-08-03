import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, type OrderStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { serializeOrderListItem } from "../orders/orders.serializer";

const orderInclude = {
  service: true,
  user: true,
  assignedAdmin: true,
  invoice: true,
  result: true,
  activity: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.OrderInclude;

const ALL_STATUSES: OrderStatus[] = [
  "waiting_payment",
  "paid",
  "waiting_action",
  "in_process",
  "done",
  "rejected",
  "cancel",
];

@Injectable()
export class AdminOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  private async redactFor(viewerAdminId: string): Promise<boolean> {
    const viewer = await this.prisma.admin.findUnique({
      where: { id: viewerAdminId },
      select: { role: true },
    });
    return viewer?.role !== "super_admin";
  }

  async list(viewerAdminId: string, q?: string, status?: string) {
    const redactUser = await this.redactFor(viewerAdminId);
    const needle = String(q ?? "").trim();
    const statusFilter =
      status && ALL_STATUSES.includes(status as OrderStatus)
        ? (status as OrderStatus)
        : undefined;

    const userSearch =
      !redactUser && needle
        ? [
            {
              user: {
                OR: [
                  { fullName: { contains: needle, mode: "insensitive" as const } },
                  { username: { contains: needle, mode: "insensitive" as const } },
                ],
              },
            },
          ]
        : [];

    const rows = await this.prisma.order.findMany({
      where: {
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(needle
          ? {
              OR: [
                { orderId: { contains: needle, mode: "insensitive" } },
                { imei: { contains: needle } },
                ...userSearch,
              ],
            }
          : {}),
      },
      include: orderInclude,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return rows.map((row) => serializeOrderListItem(row, { redactUser }));
  }

  async get(viewerAdminId: string, publicOrderId: string) {
    const redactUser = await this.redactFor(viewerAdminId);
    const order = await this.prisma.order.findUnique({
      where: { orderId: publicOrderId },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException("Order tidak ditemukan.");
    return serializeOrderListItem(order, { redactUser });
  }

  async overrideStatus(
    adminId: string,
    publicOrderId: string,
    status: string,
    note?: string,
  ) {
    if (!ALL_STATUSES.includes(status as OrderStatus)) {
      throw new BadRequestException("Status tidak valid.");
    }
    const admin = await this.prisma.admin.findUniqueOrThrow({
      where: { id: adminId },
    });
    const order = await this.prisma.order.findUnique({
      where: { orderId: publicOrderId },
    });
    if (!order) throw new NotFoundException("Order tidak ditemukan.");

    const next = status as OrderStatus;
    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: next,
        ...(next === "done" && !order.completedAt
          ? { completedAt: new Date() }
          : {}),
        ...(next === "in_process" && !order.startedAt
          ? { startedAt: new Date() }
          : {}),
        activity: {
          create: {
            status: next,
            note:
              String(note ?? "").trim() ||
              `Status diubah manual oleh Super Admin menjadi ${next}.`,
            actor: admin.fullName,
          },
        },
      },
      include: orderInclude,
    });
    return serializeOrderListItem(updated, {
      redactUser: admin.role !== "super_admin",
    });
  }

  async dashboardStats(viewerAdminId: string) {
    const redactUser = await this.redactFor(viewerAdminId);
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const [
      totalOrders,
      waitingAction,
      inProcess,
      done,
      ordersToday,
      users,
      services,
      paidToday,
      recent,
    ] = await Promise.all([
      this.prisma.order.count(),
      this.prisma.order.count({ where: { status: "waiting_action" } }),
      this.prisma.order.count({ where: { status: "in_process" } }),
      this.prisma.order.count({ where: { status: "done" } }),
      this.prisma.order.count({ where: { createdAt: { gte: start } } }),
      this.prisma.user.count(),
      this.prisma.service.count({ where: { active: true } }),
      this.prisma.paymentInvoice.aggregate({
        where: { paymentStatus: "paid", paidAt: { gte: start } },
        _sum: { amount: true },
      }),
      this.prisma.order.findMany({
        include: orderInclude,
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
    ]);

    return {
      totalOrders,
      waitingAction,
      inProcess,
      done,
      ordersToday,
      totalUsers: users,
      activeServices: services,
      revenueToday: paidToday._sum.amount ?? 0,
      recentOrders: recent.map((row) =>
        serializeOrderListItem(row, { redactUser }),
      ),
    };
  }
}
