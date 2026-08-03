import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Bot, Context, InlineKeyboard } from "grammy";
import type { Admin, ResultStatus, User } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { webPublicUrl } from "../config/env";
import { OrdersService } from "../orders/orders.service";
import { TelegramLinkTokenService } from "./telegram-link-token.service";
import {
  TELEGRAM_PARSE_MODE,
  blockedHtml,
  botDisabledHtml,
  escapeHtml,
  formatRp,
  linkFailedHtml,
  linkSuccessHtml,
  orderCreatedHtml,
  orderHistoryHtml,
  saldoAdminHtml,
  saldoMemberHtml,
  startLinkedAdminHtml,
  startLinkedMemberHtml,
  statusAdminHtml,
  statusMemberHtml,
  unlinkedHtml,
} from "./telegram-messages";

const BOT_COMMANDS = [
  { command: "start", description: "Mulai / status tautan" },
  { command: "status", description: "Info akun tertaut" },
  { command: "saldo", description: "Cek saldo kredit" },
  { command: "order", description: "Buat order baru" },
  { command: "riwayat", description: "5 order terakhir" },
] as const;

type TelegramActor =
  | {
      kind: "admin";
      admin: Pick<Admin, "id" | "username" | "role" | "status" | "fullName">;
    }
  | { kind: "member"; user: User };

type ChatSession =
  | { kind: "reject"; orderId: string; adminId: string }
  | {
      kind: "done_note";
      orderId: string;
      adminId: string;
      resultStatus: ResultStatus;
    }
  | { kind: "user_imei"; userId: string; serviceCode: string; serviceName: string; price: number };

@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramBotService.name);
  private bot: Bot | null = null;
  private ready = false;
  private polling = false;
  private readonly seenUpdateIds = new Map<number, number>();
  private readonly sessions = new Map<string, ChatSession>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly linkTokens: TelegramLinkTokenService,
    private readonly orders: OrdersService,
  ) {}

  getBot(): Bot | null {
    return this.bot;
  }

  isReady(): boolean {
    return this.ready;
  }

  async onModuleInit() {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    if (!token) {
      this.logger.warn("TELEGRAM_BOT_TOKEN empty — Telegram bot disabled");
      return;
    }

    this.bot = new Bot(token);
    this.registerHandlers(this.bot);
    this.bot.catch((error) => {
      const updateId = error.ctx.update.update_id;
      const detail =
        error.error instanceof Error
          ? error.error.message
          : typeof error.error === "string"
            ? error.error
            : String(error.error);
      this.logger.error(`Telegram update ${updateId} failed: ${detail}`);
    });

    try {
      await this.bot.init();
      this.ready = true;
      this.logger.log("Telegram bot initialized");
    } catch (err) {
      this.logger.error(
        `Telegram bot initialization failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return;
    }

    try {
      await this.bot.api.setMyCommands([...BOT_COMMANDS]);
    } catch (err) {
      this.logger.warn(
        `setMyCommands failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const mode = (process.env.TELEGRAM_MODE ?? "polling").toLowerCase();
    if (mode === "polling") {
      const allowStealWebhook = process.env.TELEGRAM_ALLOW_PROD_POLLING === "1";
      if (!allowStealWebhook) {
        try {
          const info = await this.bot.api.getWebhookInfo();
          if (info.url) {
            this.logger.error(
              `Refusing TELEGRAM_MODE=polling: webhook already set to ${info.url}.`,
            );
            return;
          }
        } catch (err) {
          this.logger.warn(
            `getWebhookInfo failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
      this.polling = true;
      this.bot.start({
        onStart: () => this.logger.log("Telegram bot polling started"),
      });
    } else {
      this.logger.log("Telegram bot in webhook mode");
    }
  }

  async onModuleDestroy() {
    this.ready = false;
    if (this.bot && this.polling) await this.bot.stop();
  }

  private async replyHtml(
    ctx: Context,
    html: string,
    extra: Record<string, unknown> = {},
  ) {
    return ctx.reply(html, { parse_mode: TELEGRAM_PARSE_MODE, ...extra });
  }

  private registerHandlers(bot: Bot) {
    bot.use(async (ctx, next) => {
      const updateId = ctx.update.update_id;
      if (typeof updateId === "number") {
        const now = Date.now();
        if (this.seenUpdateIds.has(updateId)) return;
        this.seenUpdateIds.set(updateId, now + 10 * 60_000);
        if (this.seenUpdateIds.size > 2_000) {
          for (const [id, expiresAt] of this.seenUpdateIds) {
            if (expiresAt <= now) this.seenUpdateIds.delete(id);
          }
        }
      }
      return next();
    });

    bot.command("start", async (ctx) => {
      const chatId = String(ctx.chat?.id ?? "");
      const token = String(ctx.match ?? "").trim();
      if (token) {
        try {
          const linked = await this.linkTokens.consume({
            token,
            telegramUserId: String(ctx.from?.id ?? ""),
            chatId,
            username: ctx.from?.username,
          });
          await this.replyHtml(
            ctx,
            linkSuccessHtml(linked.actorType === "admin" ? "admin" : "member"),
          );
        } catch {
          await this.replyHtml(ctx, linkFailedHtml());
        }
        return;
      }
      const actor = await this.resolveActor(chatId);
      if (!actor) {
        await this.replyHtml(ctx, unlinkedHtml(`${webPublicUrl()}/login`));
        return;
      }
      if (actor.kind === "admin") {
        await this.replyHtml(
          ctx,
          startLinkedAdminHtml({
            username: actor.admin.username,
            role: actor.admin.role,
          }),
        );
        return;
      }
      await this.replyHtml(
        ctx,
        startLinkedMemberHtml({
          username: actor.user.username,
          balance: actor.user.creditBalance,
        }),
      );
    });

    bot.command("status", async (ctx) => {
      const actor = await this.requireMemberOrAdmin(ctx);
      if (!actor) return;
      if (actor.kind === "admin") {
        await this.replyHtml(
          ctx,
          statusAdminHtml({
            username: actor.admin.username,
            role: actor.admin.role,
            status: actor.admin.status,
            portalUrl: `${webPublicUrl()}/admin`,
          }),
        );
        return;
      }
      await this.replyHtml(
        ctx,
        statusMemberHtml({
          fullName: actor.user.fullName,
          username: actor.user.username,
          balance: actor.user.creditBalance,
          status: actor.user.status,
          portalUrl: `${webPublicUrl()}/app`,
        }),
      );
    });

    bot.command("saldo", async (ctx) => {
      const actor = await this.requireMemberOrAdmin(ctx);
      if (!actor) return;
      if (actor.kind === "admin") {
        await this.replyHtml(ctx, saldoAdminHtml());
        return;
      }
      await this.replyHtml(
        ctx,
        saldoMemberHtml({
          balance: actor.user.creditBalance,
          portalUrl: `${webPublicUrl()}/app`,
        }),
      );
    });

    bot.command("order", async (ctx) => {
      const actor = await this.requireMemberOrAdmin(ctx);
      if (!actor) return;
      if (actor.kind === "admin") {
        await this.replyHtml(
          ctx,
          "Admin tidak membuat order. Gunakan notifikasi Terima/Tolak/Done.",
        );
        return;
      }
      try {
        const services = await this.orders.listServices(actor.user.id);
        if (!services.length) {
          await this.replyHtml(ctx, "Belum ada layanan aktif.");
          return;
        }
        const keyboard = new InlineKeyboard();
        for (const service of services) {
          keyboard
            .text(
              `${service.name} — ${formatRp(service.price)}`,
              `uord:svc:${service.code ?? service.id}`,
            )
            .row();
        }
        await this.replyHtml(ctx, "📦 <b>Buat order</b>\nPilih layanan:", {
          reply_markup: keyboard,
        });
      } catch (err: any) {
        await this.replyHtml(
          ctx,
          `⚠️ ${escapeHtml(err?.message ?? "Gagal memuat layanan")}`,
        );
      }
    });

    bot.command("riwayat", async (ctx) => {
      const actor = await this.requireMemberOrAdmin(ctx);
      if (!actor) return;
      if (actor.kind === "admin") {
        const rows = await this.orders.listAdminQueue(actor.admin.id, 5);
        await this.replyHtml(
          ctx,
          orderHistoryHtml(
            rows.map((o) => ({
              orderId: o.orderId,
              serviceName: o.service.name,
              status: o.status,
              imei: o.imei,
            })),
          ),
        );
        return;
      }
      const rows = await this.orders.listRecentForUser(actor.user.id, 5);
      await this.replyHtml(
        ctx,
        orderHistoryHtml(
          rows.map((o) => ({
            orderId: o.orderId,
            serviceName: o.service.name,
            status: o.status,
            imei: o.imei,
          })),
        ),
      );
    });

    bot.on("callback_query:data", async (ctx) => {
      const data = ctx.callbackQuery.data ?? "";
      const chatId = String(ctx.chat?.id ?? ctx.from?.id ?? "");
      try {
        if (data.startsWith("ord:accept:")) {
          await this.handleAccept(ctx, data.slice("ord:accept:".length));
        } else if (data.startsWith("ord:reject:")) {
          await this.handleRejectStart(ctx, data.slice("ord:reject:".length));
        } else if (data.startsWith("ord:done:")) {
          await this.handleDoneStart(ctx, data.slice("ord:done:".length));
        } else if (data.startsWith("ord:rs:")) {
          await this.handleDoneStatus(ctx, data.slice("ord:rs:".length));
        } else if (data.startsWith("uord:svc:")) {
          await this.handleUserServicePick(ctx, data.slice("uord:svc:".length));
        } else {
          await ctx.answerCallbackQuery({ text: "Aksi tidak dikenal" });
        }
      } catch (err: any) {
        this.logger.warn(`callback failed chat=${chatId}: ${err?.message}`);
        await ctx
          .answerCallbackQuery({
            text: String(err?.message ?? "Gagal").slice(0, 180),
            show_alert: true,
          })
          .catch(() => undefined);
      }
    });

    bot.on("message:text", async (ctx, next) => {
      const text = ctx.message?.text ?? "";
      if (text.startsWith("/")) return next();
      const chatId = String(ctx.chat?.id ?? "");
      const session = this.sessions.get(chatId);
      if (!session) return next();

      if (session.kind === "reject") {
        this.sessions.delete(chatId);
        try {
          await this.orders.rejectOrder(
            session.adminId,
            session.orderId,
            text.trim(),
          );
          await this.replyHtml(ctx, `❌ Order <code>${escapeHtml(session.orderId)}</code> ditolak.`);
        } catch (err: any) {
          await this.replyHtml(
            ctx,
            `⚠️ ${escapeHtml(err?.message ?? "Gagal menolak")}`,
          );
        }
        return;
      }

      if (session.kind === "done_note") {
        this.sessions.delete(chatId);
        try {
          await this.orders.completeOrder(session.adminId, session.orderId, {
            resultStatus: session.resultStatus,
            resultNote: text.trim(),
          });
          await this.replyHtml(
            ctx,
            `✅ Order <code>${escapeHtml(session.orderId)}</code> selesai.`,
          );
        } catch (err: any) {
          await this.replyHtml(
            ctx,
            `⚠️ ${escapeHtml(err?.message ?? "Gagal menyelesaikan")}`,
          );
        }
        return;
      }

      if (session.kind === "user_imei") {
        const imei = text.replace(/\D/g, "");
        if (!/^\d{15}$/.test(imei)) {
          await this.replyHtml(ctx, "IMEI harus 15 digit angka. Coba lagi.");
          return;
        }
        this.sessions.delete(chatId);
        try {
          const order = await this.orders.createOrder(session.userId, {
            serviceCode: session.serviceCode,
            imei,
            channel: "telegram",
          });
          const payUrl = `${webPublicUrl()}/app/order/${order.orderId}/bayar`;
          await this.replyHtml(
            ctx,
            orderCreatedHtml({
              orderId: order.orderId,
              payUrl,
              amount: order.price,
            }),
          );
        } catch (err: any) {
          await this.replyHtml(
            ctx,
            `⚠️ ${escapeHtml(err?.message ?? "Gagal membuat order")}`,
          );
        }
        return;
      }

      return next();
    });
  }

  private async handleAccept(ctx: Context, orderId: string) {
    const actor = await this.requireAdmin(ctx);
    if (!actor) return;
    await this.orders.acceptOrder(actor.admin.id, orderId);
    await ctx.answerCallbackQuery({ text: "Order diambil" });
    await this.replyHtml(
      ctx,
      `🛠️ Anda mengambil <code>${escapeHtml(orderId)}</code>. Kerjakan lalu tekan Done.`,
    );
  }

  private async handleRejectStart(ctx: Context, orderId: string) {
    const actor = await this.requireAdmin(ctx);
    if (!actor) return;
    const chatId = String(ctx.chat?.id ?? "");
    this.sessions.set(chatId, {
      kind: "reject",
      orderId,
      adminId: actor.admin.id,
    });
    await ctx.answerCallbackQuery();
    await this.replyHtml(
      ctx,
      `Kirim <b>alasan penolakan</b> untuk <code>${escapeHtml(orderId)}</code>.`,
    );
  }

  private async handleDoneStart(ctx: Context, orderId: string) {
    const actor = await this.requireAdmin(ctx);
    if (!actor) return;
    const keyboard = new InlineKeyboard()
      .text("success", `ord:rs:${orderId}:success`)
      .text("partial", `ord:rs:${orderId}:partial`)
      .text("failed", `ord:rs:${orderId}:failed`);
    await ctx.answerCallbackQuery();
    await this.replyHtml(
      ctx,
      `Pilih <b>status hasil</b> untuk <code>${escapeHtml(orderId)}</code>:`,
      { reply_markup: keyboard },
    );
  }

  private async handleDoneStatus(ctx: Context, payload: string) {
    const actor = await this.requireAdmin(ctx);
    if (!actor) return;
    const parts = payload.split(":");
    const resultStatus = parts.pop() as ResultStatus;
    const orderId = parts.join(":");
    if (!["success", "partial", "failed"].includes(resultStatus)) {
      await ctx.answerCallbackQuery({ text: "Status tidak valid", show_alert: true });
      return;
    }
    const chatId = String(ctx.chat?.id ?? "");
    this.sessions.set(chatId, {
      kind: "done_note",
      orderId,
      adminId: actor.admin.id,
      resultStatus,
    });
    await ctx.answerCallbackQuery();
    await this.replyHtml(
      ctx,
      `Kirim <b>catatan hasil</b> untuk <code>${escapeHtml(orderId)}</code> (${resultStatus}).`,
    );
  }

  private async handleUserServicePick(ctx: Context, serviceCode: string) {
    const actor = await this.requireMember(ctx);
    if (!actor) return;
    const services = await this.orders.listServices(actor.user.id);
    const service = services.find(
      (s) => s.code === serviceCode || s.id === serviceCode,
    );
    if (!service) {
      await ctx.answerCallbackQuery({ text: "Layanan tidak ditemukan", show_alert: true });
      return;
    }
    const chatId = String(ctx.chat?.id ?? "");
    this.sessions.set(chatId, {
      kind: "user_imei",
      userId: actor.user.id,
      serviceCode: service.code ?? serviceCode,
      serviceName: service.name,
      price: service.price,
    });
    await ctx.answerCallbackQuery();
    await this.replyHtml(
      ctx,
      [
        `Layanan: <b>${escapeHtml(service.name)}</b> (${formatRp(service.price)})`,
        "",
        "Kirim <b>IMEI 15 digit</b> sekarang.",
      ].join("\n"),
    );
  }

  private async resolveActor(chatId: string): Promise<TelegramActor | null> {
    const admin = await this.prisma.admin.findFirst({
      where: { telegramChatId: chatId, status: "active" },
      select: {
        id: true,
        username: true,
        role: true,
        status: true,
        fullName: true,
      },
    });
    if (admin) return { kind: "admin", admin };

    const identity = await this.prisma.userIdentity.findFirst({
      where: {
        provider: "telegram",
        chatId,
        chatVerifiedAt: { not: null },
      },
      include: { user: true },
    });
    if (identity?.user) return { kind: "member", user: identity.user };
    return null;
  }

  private async requireMemberOrAdmin(
    ctx: Context,
  ): Promise<TelegramActor | null> {
    const chatId = String(ctx.chat?.id ?? "");
    const actor = await this.resolveActor(chatId);
    if (!actor) {
      await this.replyHtml(ctx, unlinkedHtml(`${webPublicUrl()}/login`));
      return null;
    }
    if (actor.kind === "admin") return actor;
    if (actor.user.status === "suspended") {
      await this.replyHtml(ctx, blockedHtml());
      return null;
    }
    if (!actor.user.botAccess) {
      await this.replyHtml(
        ctx,
        botDisabledHtml(`${webPublicUrl()}/app/telegram`),
      );
      return null;
    }
    return actor;
  }

  private async requireAdmin(
    ctx: Context,
  ): Promise<Extract<TelegramActor, { kind: "admin" }> | null> {
    const actor = await this.requireMemberOrAdmin(ctx);
    if (!actor) return null;
    if (actor.kind !== "admin") {
      await ctx
        .answerCallbackQuery({ text: "Khusus admin", show_alert: true })
        .catch(() => undefined);
      return null;
    }
    return actor;
  }

  private async requireMember(
    ctx: Context,
  ): Promise<Extract<TelegramActor, { kind: "member" }> | null> {
    const actor = await this.requireMemberOrAdmin(ctx);
    if (!actor) return null;
    if (actor.kind !== "member") {
      await ctx
        .answerCallbackQuery({ text: "Khusus user", show_alert: true })
        .catch(() => undefined);
      return null;
    }
    return actor;
  }
}
