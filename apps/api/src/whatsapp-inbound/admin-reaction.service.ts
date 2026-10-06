import { HttpException, Injectable, Logger } from "@nestjs/common";
import type { OrderStatus } from "@prisma/client";
import { whatsappAdminConfig } from "../config/env";
import { OrdersService } from "../orders/orders.service";
import { PrismaService } from "../prisma/prisma.service";
import { WahaClient } from "../whatsapp/waha.client";
import { WhatsappAdminService } from "../whatsapp/whatsapp-admin.service";
import { jidPhone, reactionAction, type ReactionAction } from "./admin-reaction-parser";

export type WahaReactionPayload = {
  from?: unknown;
  fromMe?: unknown;
  participant?: unknown;
  reaction?: { text?: unknown; messageId?: unknown } | null;
};

const LID_TTL_MS = 6 * 60 * 60_000;
const LID_MISS_TTL_MS = 10 * 60_000;

const FINAL_LABEL: Partial<Record<OrderStatus, string>> = {
  done: "Done",
  rejected: "ditolak",
  cancel: "dibatalkan",
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
  ) {}

  /** Returns a short outcome for logs. */
  async handle(payload: WahaReactionPayload): Promise<string> {
    const config = whatsappAdminConfig();
    if (!config) return "off";
    if (payload.fromMe === true) return "ignored: own reaction";
    if (payload.from !== config.groupChatId) return "ignored: other chat";

    const emoji = typeof payload.reaction?.text === "string" ? payload.reaction.text : "";
    const action = reactionAction(emoji);
    if (!action) return "ignored: emoji";
    const messageId = payload.reaction?.messageId;
    if (typeof messageId !== "string" || !messageId) return "ignored: no message id";

    const card = await this.cards.findByMessage(messageId);
    if (!card) return "ignored: not an order card";
    const order = card.order;

    const admin = await this.resolveAdmin(payload.participant);
    if (!admin || admin.status !== "active") {
      await this.cards.reply(order.id, {
        kind: "refused",
        message: "Nomor WhatsApp ini belum terdaftar sebagai admin aktif di ZittoSite.",
      });
      return `${order.orderId} ${action}: unknown sender`;
    }

    const final = FINAL_LABEL[order.status];
    if (final) {
      const same =
        (order.status === "done" && action === "done") ||
        (order.status === "rejected" && action === "reject");
      if (!same) {
        await this.cards.reply(order.id, { kind: "refused", message: `Order sudah ${final}.` });
      }
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
      await this.cards.reply(order.id, { kind: "refused", message });
      return `${order.orderId} ${action}: refused (${message})`;
    }

    await this.cards.reply(
      order.id,
      action === "take"
        ? { kind: "taken", adminName: admin.fullName }
        : action === "done"
          ? { kind: "done", adminName: admin.fullName }
          : { kind: "rejected", adminName: admin.fullName, refunded: true },
    );
    return `${order.orderId} ${action}: applied by ${admin.fullName}`;
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
