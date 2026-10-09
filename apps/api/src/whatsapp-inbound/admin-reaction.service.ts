import { HttpException, Injectable, Logger } from "@nestjs/common";
import type { OrderStatus } from "@prisma/client";
import { whatsappAdminEnabled, whatsappConfig } from "../config/env";
import { orderDayWhere } from "../orders/order-day";
import { OrdersService } from "../orders/orders.service";
import { PrismaService } from "../prisma/prisma.service";
import { AdminNotifyService } from "../telegram/admin-notify.service";
import { escapeHtml } from "../telegram/telegram-messages";
import { WahaClient } from "../whatsapp/waha.client";
import { WhatsappAdminService } from "../whatsapp/whatsapp-admin.service";
import { adminDailyCountText, type DailyCountRow } from "../whatsapp/whatsapp-messages";
import {
  isCountCommand,
  jidPhone,
  reactionAction,
  type ReactionAction,
} from "./admin-reaction-parser";
import type { WahaMessagePayload } from "./roamercheck.service";

export type WahaReactionPayload = {
  from?: unknown;
  fromMe?: unknown;
  participant?: unknown;
  reaction?: { text?: unknown; messageId?: unknown } | null;
};

const LID_TTL_MS = 6 * 60 * 60_000;
const LID_MISS_TTL_MS = 10 * 60_000;
const WIB_OFFSET_MS = 7 * 60 * 60_000;
const DAY_MS = 24 * 60 * 60_000;

/** Start of the current Asia/Jakarta day, and its "dd-mm-yyyy" label. */
export function wibToday(now = new Date()): { start: Date; label: string } {
  const wibMidnight = Math.floor((now.getTime() + WIB_OFFSET_MS) / DAY_MS) * DAY_MS;
  const d = new Date(wibMidnight);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    start: new Date(wibMidnight - WIB_OFFSET_MS),
    label: `${pad(d.getUTCDate())}-${pad(d.getUTCMonth() + 1)}-${d.getUTCFullYear()}`,
  };
}

function wibTime(date: Date): string {
  const d = new Date(date.getTime() + WIB_OFFSET_MS);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** Reactions on finished orders are ignored without a word. */
const FINAL_STATUSES = new Set<OrderStatus>(["done", "rejected", "cancel"]);

const ACTION_LABEL: Record<ReactionAction, string> = {
  take: "⏳ Proses",
  done: "✅ Done",
  reject: "❌ Tolak",
};

type ReactingAdmin = { id: string; fullName: string; status: string };

/** Turns admin reactions on order cards in the admin WhatsApp group into status updates. */
@Injectable()
export class AdminReactionService {
  private readonly logger = new Logger(AdminReactionService.name);
  private readonly lids = new Map<string, { lid: string | null; at: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly waha: WahaClient,
    private readonly cards: WhatsappAdminService,
    private readonly notify: AdminNotifyService,
  ) {}

  /** Returns a short outcome for logs. */
  async handle(payload: WahaReactionPayload): Promise<string> {
    if (!whatsappAdminEnabled()) return "off";
    if (payload.fromMe === true) return "ignored: own reaction";

    const emoji = typeof payload.reaction?.text === "string" ? payload.reaction.text : "";
    const action = reactionAction(emoji);
    if (!action) return "ignored: emoji";
    const messageId = payload.reaction?.messageId;
    if (typeof messageId !== "string" || !messageId) return "ignored: no message id";

    const card = await this.cards.findByMessage(messageId);
    if (!card) return "ignored: not an order card";
    if (payload.from !== card.chatId) return "ignored: other chat";
    const order = card.order;

    // The group gets no replies; Super Admins follow status changes (and refusals) on Telegram.
    const admin = await this.resolveAdmin(payload.participant);
    if (!admin || admin.status !== "active") {
      await this.warnSuperAdmins(
        order.orderId,
        action,
        `pengirim ${jidPhone(String(payload.participant ?? "")) ?? "tidak dikenal"} belum terdaftar sebagai admin aktif.`,
      );
      return `${order.orderId} ${action}: unknown sender`;
    }

    if (FINAL_STATUSES.has(order.status)) {
      return `${order.orderId} ${action}: already ${order.status}`;
    }
    if (action === "take" && order.status === "in_process" && order.assignedAdminId === admin.id) {
      return `${order.orderId} take: already own`;
    }

    try {
      await this.apply(action, admin.id, order.orderId, order.status);
    } catch (err) {
      const message =
        err instanceof HttpException ? err.message : "Gagal memperbarui order, coba lagi.";
      if (!(err instanceof HttpException)) {
        this.logger.warn(
          `Reaction ${action} on ${order.orderId} failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      await this.warnSuperAdmins(order.orderId, action, `${admin.fullName}: ${message}`);
      return `${order.orderId} ${action}: refused (${message})`;
    }
    return `${order.orderId} ${action}: applied by ${admin.fullName}`;
  }

  private async warnSuperAdmins(orderId: string, action: ReactionAction, why: string) {
    await this.notify.notifySuperAdmins(
      `⚠️ <b>React WhatsApp tidak diproses</b> · ${escapeHtml(orderId)}\n` +
        `${ACTION_LABEL[action]}: ${escapeHtml(why)}`,
    );
  }

  /** "/hitung" in an admin group: replies with the sender's orders handled today (WIB). */
  async handleCommand(payload: WahaMessagePayload): Promise<string | null> {
    const text = typeof payload.body === "string" ? payload.body : "";
    if (!isCountCommand(text)) return null;
    if (!whatsappAdminEnabled()) return "off";
    if (payload.fromMe === true) return "ignored: own message";
    const chatId = typeof payload.from === "string" ? payload.from : "";
    if (!chatId.endsWith("@g.us") || chatId === whatsappConfig()?.groupChatId) {
      return "ignored: other chat";
    }
    const replyTo = typeof payload.id === "string" ? payload.id : undefined;

    const admin = await this.resolveAdmin(payload.participant);
    if (!admin || admin.status !== "active") {
      await this.send(chatId, "⚠️ Nomor WhatsApp ini belum terdaftar sebagai admin aktif di ZittoSite.", replyTo);
      return "/hitung: unknown sender";
    }

    const today = wibToday();
    const orders = await this.prisma.order.findMany({
      where: {
        assignedAdminId: admin.id,
        status: { in: ["in_process", "done", "rejected"] },
        ...orderDayWhere({ gte: today.start, lt: new Date(today.start.getTime() + DAY_MS) }),
      },
      select: { imei: true, status: true, startedAt: true, updatedAt: true },
    });
    const rows = orders
      .map((order) => ({ at: order.startedAt ?? order.updatedAt, order }))
      .sort((a, b) => a.at.getTime() - b.at.getTime())
      .map(
        ({ at, order }): DailyCountRow => ({
          time: wibTime(at),
          imei: order.imei,
          status: order.status as DailyCountRow["status"],
        }),
      );
    await this.send(
      chatId,
      adminDailyCountText({ adminName: admin.fullName, date: today.label, rows }),
      replyTo,
    );
    return `/hitung: ${admin.fullName} ${rows.length} order`;
  }

  private async send(chatId: string, text: string, replyTo?: string) {
    try {
      await this.waha.sendText(chatId, text, replyTo);
    } catch (err) {
      this.logger.warn(`WhatsApp reply failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async apply(
    action: ReactionAction,
    adminId: string,
    orderId: string,
    status: OrderStatus,
  ) {
    if (action === "take") {
      await this.orders.acceptOrder(adminId, orderId);
    } else if (action === "done") {
      // ✅ straight on a waiting order takes it first, so one reaction is enough.
      if (status === "waiting_action") await this.orders.acceptOrder(adminId, orderId);
      await this.orders.completeOrder(adminId, orderId, { resultStatus: "success", resultNote: "" });
    } else {
      await this.orders.rejectOrder(adminId, orderId);
    }
  }

  /** Admin behind a group participant id, matched on their registered WhatsApp number. */
  private async resolveAdmin(participant: unknown): Promise<ReactingAdmin | null> {
    if (typeof participant !== "string") return null;
    const admins = await this.prisma.admin.findMany({
      where: { whatsappNumber: { not: null } },
      select: { id: true, fullName: true, status: true, whatsappNumber: true },
    });
    const phone = jidPhone(participant);
    if (phone) return admins.find((a) => a.whatsappNumber === phone) ?? null;
    if (!participant.endsWith("@lid")) return null;
    for (const admin of admins) {
      if ((await this.lidFor(admin.whatsappNumber!)) === participant) return admin;
    }
    return null;
  }

  private async lidFor(phone: string): Promise<string | null> {
    const cached = this.lids.get(phone);
    const ttl = cached?.lid ? LID_TTL_MS : LID_MISS_TTL_MS;
    if (cached && Date.now() - cached.at < ttl) return cached.lid;
    const lid = await this.waha.lidForPhone(phone);
    this.lids.set(phone, { lid, at: Date.now() });
    return lid;
  }
}
