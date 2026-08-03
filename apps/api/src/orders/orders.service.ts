import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, type OrderChannel, type ResultStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AdminNotifyService } from "../telegram/admin-notify.service";
import { serializeOrderListItem, serializeService } from "./orders.serializer";

const INVOICE_TTL_MS = 30 * 60 * 1000;

const orderInclude = {
  service: true,
  user: true,
  assignedAdmin: true,
  invoice: true,
  result: true,
  activity: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.OrderInclude;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminNotify: AdminNotifyService,
  ) {}

  async listServices(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { customPrice: true },
    });
    const services = await this.prisma.service.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    });
    return services.map((service) =>
      serializeService(service, this.effectivePrice(service, user.customPrice)),
    );
  }

  async listOrders(userId: string, q?: string) {
    const needle = String(q ?? "").trim();
    const rows = await this.prisma.order.findMany({
      where: {
        userId,
        ...(needle
          ? {
              OR: [
                { orderId: { contains: needle, mode: "insensitive" } },
                { imei: { contains: needle } },
              ],
            }
          : {}),
      },
      include: orderInclude,
      orderBy: { createdAt: "desc" },
    });
    const refreshed = [];
    for (const row of rows) {
      refreshed.push(await this.ensureNotExpired(row));
    }
    return refreshed.map((row) => serializeOrderListItem(row));
  }

  async getOrder(userId: string, publicOrderId: string) {
    const order = await this.findOwned(userId, publicOrderId);
    return serializeOrderListItem(await this.ensureNotExpired(order));
  }

  async createOrder(
    userId: string,
    input: {
      serviceId?: string;
      serviceCode?: string;
      imei?: string;
      notes?: string;
      channel?: OrderChannel;
    },
  ) {
    let serviceId = String(input.serviceId ?? "").trim();
    const serviceCode = String(input.serviceCode ?? "").trim();
    const imei = String(input.imei ?? "").trim();
    const notes = String(input.notes ?? "").trim() || null;
    const channel: OrderChannel = input.channel ?? "web";

    if (!serviceId && serviceCode) {
      const byCode = await this.prisma.service.findUnique({
        where: { code: serviceCode },
      });
      if (byCode) serviceId = byCode.id;
    }
    if (!serviceId) throw new BadRequestException("Pilih layanan.");
    if (!/^\d{15}$/.test(imei)) {
      throw new BadRequestException("IMEI harus 15 digit angka.");
    }

    const existing = await this.prisma.order.findFirst({
      where: { userId, status: "waiting_payment" },
      select: { orderId: true },
    });
    if (existing) {
      throw new ConflictException(
        `Selesaikan atau batalkan order ${existing.orderId} yang masih menunggu pembayaran.`,
      );
    }

    const [user, service] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      this.prisma.service.findUnique({ where: { id: serviceId } }),
    ]);
    if (!service || !service.active) {
      throw new BadRequestException("Layanan tidak tersedia.");
    }

    const price = this.effectivePrice(service, user.customPrice);
    const orderId = await this.nextOrderId();
    const invoiceId = `INV-${orderId}`;
    const expiredAt = new Date(Date.now() + INVOICE_TTL_MS);
    const via = channel === "telegram" ? "Telegram" : "website";

    const created = await this.prisma.order.create({
      data: {
        orderId,
        userId,
        serviceId: service.id,
        channel,
        imei,
        notes,
        status: "waiting_payment",
        price,
        invoice: {
          create: {
            invoiceId,
            amount: price,
            paymentChannel: "qris_placeholder",
            paymentStatus: "pending",
            expiredAt,
          },
        },
        activity: {
          create: {
            status: "waiting_payment",
            note: `Order dibuat lewat ${via}. Invoice QRIS diterbitkan.`,
            actor: user.fullName,
          },
        },
      },
      include: orderInclude,
    });

    return serializeOrderListItem(created);
  }

  async cancelOrder(userId: string, publicOrderId: string) {
    const order = await this.findOwned(userId, publicOrderId);
    const current = await this.ensureNotExpired(order);
    if (current.status !== "waiting_payment") {
      throw new BadRequestException(
        "Hanya order menunggu pembayaran yang dapat dibatalkan.",
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (current.invoice) {
        await tx.paymentInvoice.update({
          where: { id: current.invoice.id },
          data: { paymentStatus: "cancelled" },
        });
      }
      return tx.order.update({
        where: { id: current.id },
        data: {
          status: "cancel",
          activity: {
            create: {
              status: "cancel",
              note: "Order dibatalkan oleh user.",
              actor: current.user.fullName,
            },
          },
        },
        include: orderInclude,
      });
    });
    return serializeOrderListItem(updated);
  }

  async markPaid(userId: string, publicOrderId: string) {
    const order = await this.findOwned(userId, publicOrderId);
    const current = await this.ensureNotExpired(order);

    if (
      current.status === "waiting_action" ||
      current.status === "paid" ||
      current.status === "in_process" ||
      current.status === "done"
    ) {
      return serializeOrderListItem(current);
    }
    if (current.status !== "waiting_payment") {
      throw new BadRequestException("Order ini tidak dapat ditandai lunas.");
    }
    if (!current.invoice || current.invoice.paymentStatus !== "pending") {
      throw new BadRequestException("Invoice tidak dalam status pending.");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.paymentInvoice.update({
        where: { id: current.invoice!.id },
        data: {
          paymentStatus: "paid",
          paidAt: new Date(),
          paymentReference: `SIM-${Date.now()}`,
        },
      });
      await tx.orderActivityLog.create({
        data: {
          orderId: current.id,
          status: "paid",
          note: "Pembayaran disimulasikan dan diverifikasi.",
          actor: "Sistem",
        },
      });
      return tx.order.update({
        where: { id: current.id },
        data: {
          status: "waiting_action",
          activity: {
            create: {
              status: "waiting_action",
              note: "Order masuk antrean dan siap diambil admin.",
              actor: "Sistem",
            },
          },
        },
        include: orderInclude,
      });
    });

    void this.adminNotify.notifyNewOrder(updated.id);
    return serializeOrderListItem(updated);
  }

  async acceptOrder(adminId: string, publicOrderId: string) {
    const admin = await this.prisma.admin.findUniqueOrThrow({
      where: { id: adminId },
    });
    if (admin.status !== "active") {
      throw new ForbiddenException("Akun admin tidak aktif.");
    }

    const claimed = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { orderId: publicOrderId },
      });
      if (!order) throw new NotFoundException("Order tidak ditemukan.");

      const result = await tx.order.updateMany({
        where: { id: order.id, status: "waiting_action" },
        data: {
          status: "in_process",
          assignedAdminId: adminId,
          startedAt: new Date(),
        },
      });
      if (result.count !== 1) {
        throw new ConflictException("Order sudah diambil admin lain.");
      }
      await tx.orderActivityLog.create({
        data: {
          orderId: order.id,
          status: "in_process",
          note: `Order diambil oleh ${admin.fullName}.`,
          actor: admin.fullName,
        },
      });
      return tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: orderInclude,
      });
    });

    await this.adminNotify.syncOrderCards(claimed.id, "taken", {
      actorName: admin.fullName,
    });
    void this.adminNotify.notifyUserById(
      claimed.userId,
      `🛠️ Order <b>${claimed.orderId}</b> sedang dikerjakan admin.`,
    );
    return serializeOrderListItem(claimed);
  }

  async rejectOrder(adminId: string, publicOrderId: string, reason: string) {
    const note = String(reason ?? "").trim() || "Ditolak tanpa alasan.";
    const admin = await this.prisma.admin.findUniqueOrThrow({
      where: { id: adminId },
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { orderId: publicOrderId },
      });
      if (!order) throw new NotFoundException("Order tidak ditemukan.");

      if (order.status === "waiting_action") {
        const result = await tx.order.updateMany({
          where: { id: order.id, status: "waiting_action" },
          data: { status: "rejected" },
        });
        if (result.count !== 1) {
          throw new ConflictException("Status order berubah.");
        }
      } else if (order.status === "in_process") {
        if (order.assignedAdminId !== adminId) {
          throw new ForbiddenException(
            "Hanya admin yang mengambil order yang dapat menolak.",
          );
        }
        await tx.order.update({
          where: { id: order.id },
          data: { status: "rejected" },
        });
      } else {
        throw new BadRequestException("Order tidak dapat ditolak.");
      }

      await tx.orderActivityLog.create({
        data: {
          orderId: order.id,
          status: "rejected",
          note: `Ditolak: ${note}`,
          actor: admin.fullName,
        },
      });
      return tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: orderInclude,
      });
    });

    await this.adminNotify.syncOrderCards(updated.id, "rejected", {
      actorName: admin.fullName,
      note,
    });
    void this.adminNotify.notifyUserById(
      updated.userId,
      `❌ Order <b>${updated.orderId}</b> ditolak.\nAlasan: ${note}`,
    );
    return serializeOrderListItem(updated);
  }

  async completeOrder(
    adminId: string,
    publicOrderId: string,
    input: { resultStatus: ResultStatus; resultNote: string },
  ) {
    const resultNote = String(input.resultNote ?? "").trim();
    if (!resultNote) {
      throw new BadRequestException("Catatan hasil wajib diisi.");
    }
    if (!["success", "partial", "failed"].includes(input.resultStatus)) {
      throw new BadRequestException("Status hasil tidak valid.");
    }
    const admin = await this.prisma.admin.findUniqueOrThrow({
      where: { id: adminId },
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { orderId: publicOrderId },
      });
      if (!order) throw new NotFoundException("Order tidak ditemukan.");
      if (order.status !== "in_process" || order.assignedAdminId !== adminId) {
        throw new ForbiddenException(
          "Hanya admin pemegang order yang dapat menandai Done.",
        );
      }

      await tx.orderResult.create({
        data: {
          orderId: order.id,
          resultStatus: input.resultStatus,
          resultNote,
          createdByAdminId: adminId,
        },
      });
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: "done",
          completedAt: new Date(),
        },
      });
      await tx.orderActivityLog.create({
        data: {
          orderId: order.id,
          status: "done",
          note: `Hasil dikirim (${input.resultStatus}).`,
          actor: admin.fullName,
        },
      });
      return tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: orderInclude,
      });
    });

    await this.adminNotify.syncOrderCards(updated.id, "done", {
      actorName: admin.fullName,
      note: resultNote,
    });
    void this.adminNotify.notifyUserById(
      updated.userId,
      [
        `✅ Order <b>${updated.orderId}</b> selesai.`,
        `Hasil: ${input.resultStatus}`,
        resultNote,
      ].join("\n"),
    );
    return serializeOrderListItem(updated);
  }

  async listRecentForUser(userId: string, take = 5) {
    const rows = await this.prisma.order.findMany({
      where: { userId },
      include: orderInclude,
      orderBy: { createdAt: "desc" },
      take,
    });
    return rows.map((row) => serializeOrderListItem(row));
  }

  async listAdminQueue(adminId: string, take = 5) {
    const rows = await this.prisma.order.findMany({
      where: {
        OR: [
          { status: "waiting_action" },
          { status: "in_process", assignedAdminId: adminId },
        ],
      },
      include: orderInclude,
      orderBy: { createdAt: "desc" },
      take,
    });
    return rows.map((row) => serializeOrderListItem(row));
  }

  private effectivePrice(
    service: { code: string; price: number },
    customPrice: number | null,
  ) {
    if (service.code === "activation" && customPrice != null) {
      return customPrice;
    }
    return service.price;
  }

  private async findOwned(userId: string, publicOrderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { orderId: publicOrderId, userId },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException("Order tidak ditemukan.");
    return order;
  }

  private async ensureNotExpired<
    T extends Prisma.OrderGetPayload<{ include: typeof orderInclude }>,
  >(order: T): Promise<T> {
    if (
      order.status !== "waiting_payment" ||
      !order.invoice ||
      order.invoice.paymentStatus !== "pending"
    ) {
      return order;
    }
    if (order.invoice.expiredAt.getTime() > Date.now()) {
      return order;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.paymentInvoice.updateMany({
        where: {
          id: order.invoice!.id,
          paymentStatus: "pending",
        },
        data: { paymentStatus: "expired" },
      });
      if (claimed.count !== 1) {
        return tx.order.findUniqueOrThrow({
          where: { id: order.id },
          include: orderInclude,
        });
      }
      return tx.order.update({
        where: { id: order.id },
        data: {
          status: "cancel",
          activity: {
            create: {
              status: "cancel",
              note: "Batas waktu pembayaran terlewat, order dibatalkan otomatis.",
              actor: "Sistem",
            },
          },
        },
        include: orderInclude,
      });
    });
    return updated as T;
  }

  private async nextOrderId(): Promise<string> {
    const now = new Date();
    const jakarta = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }),
    );
    const yy = String(jakarta.getFullYear()).slice(-2);
    const mm = String(jakarta.getMonth() + 1).padStart(2, "0");
    const dd = String(jakarta.getDate()).padStart(2, "0");
    const prefix = `ZT${yy}${mm}${dd}`;

    const count = await this.prisma.order.count({
      where: { orderId: { startsWith: prefix } },
    });
    const seq = String(count + 1).padStart(4, "0");
    const candidate = `${prefix}${seq}`;
    const clash = await this.prisma.order.findUnique({
      where: { orderId: candidate },
      select: { id: true },
    });
    if (!clash) return candidate;
    return `${prefix}${String(count + 2).padStart(4, "0")}`;
  }
}
