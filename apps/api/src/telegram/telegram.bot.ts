import {
  ConflictException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { Bot, Context, InlineKeyboard, InputFile } from "grammy";
import * as QRCode from "qrcode";
import type { Admin, ResultStatus, User } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { webPublicUrl } from "../config/env";
import { OrdersService } from "../orders/orders.service";
import { TelegramLinkTokenService } from "./telegram-link-token.service";
import { OrderRecapService } from "./order-recap.service";
import {
  AdminTelegramInviteService,
  INVITE_PREFIX,
} from "./admin-telegram-invite.service";
import {
  TELEGRAM_PARSE_MODE,
  blockedHtml,
  botDisabledHtml,
  escapeHtml,
  formatRp,
  inviteClaimPendingHtml,
  inviteDecidedHtml,
  inviteFailedHtml,
  linkFailedHtml,
  linkSuccessHtml,
  operatorRecapHtml,
  orderCreatedHtml,
  orderHistoryHtml,
  orderQrisCaptionHtml,
  pendingOrderHtml,
  cancelConfirmHtml,
  saldoAdminHtml,
  saldoMemberHtml,
  startLinkedAdminHtml,
  startLinkedMemberHtml,
  statusAdminHtml,
  statusMemberHtml,
  superAdminRecapHtml,
  unlinkedHtml,
} from "./telegram-messages";

const BOT_COMMANDS = [
  { command: "start", description: "Mulai / status tautan" },
  { command: "menu", description: "Menu utama" },
  { command: "status", description: "Info akun tertaut" },
  { command: "saldo", description: "Cek saldo kredit" },
  { command: "order", description: "Buat order baru" },
  { command: "riwayat", description: "5 order terakhir" },
  { command: "rekap", description: "Rekap order hari ini (admin)" },
  { command: "cancel", description: "Batalkan order: /cancel ZT… alasan (Super Admin)" },
] as const;

function adminMenuKeyboard() {
  return new InlineKeyboard()
    .text("📊 Rekap hari ini", "menu:rekap")
    .text("📋 Antrean", "menu:riwayat");
}

function recapKeyboard() {
  return new InlineKeyboard()
    .text("🔄 Perbarui", "menu:rekap")
    .text("📋 Antrean", "menu:riwayat");
}

function memberMenuKeyboard() {
  return new InlineKeyboard()
    .text("🛒 Buat Order", "menu:order")
    .text("📋 Riwayat", "menu:riwayat")
    .row()
    .text("💎 Saldo", "menu:saldo")
    .text("👤 Status", "menu:status");
}

function backToMenuKeyboard() {
  return new InlineKeyboard().text("⬅️ Menu", "menu:home");
}

function unpaidOrderKeyboard(orderId: string, withQris: boolean) {
  const keyboard = new InlineKeyboard();
  if (withQris) keyboard.text("🔳 Tampilkan QRIS", `uord:qris:${orderId}`);
  return keyboard
    .text("❌ Batalkan order", `uord:cancel:${orderId}`)
    .row()
    .text("⬅️ Menu", "menu:home");
}

function cancelConfirmKeyboard(orderId: string) {
  return new InlineKeyboard()
    .text("✅ Ya, batalkan", `uord:cancelok:${orderId}`)
    .text("↩️ Tidak", `uord:keep:${orderId}`);
}

type SerializedOrder = Awaited<ReturnType<OrdersService["getOrder"]>>;

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
    private readonly invites: AdminTelegramInviteService,
    private readonly recap: OrderRecapService,
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

  /** Sends the QRIS as a photo; returns false so the caller can fall back to the portal link. */
  private async replyQris(
    ctx: Context,
    input: { orderId: string; qris: string; amount: number; expiresAt: Date },
  ): Promise<boolean> {
    try {
      const png = await QRCode.toBuffer(input.qris, {
        type: "png",
        width: 720,
        margin: 3,
        errorCorrectionLevel: "M",
      });
      await ctx.replyWithPhoto(new InputFile(png, `QRIS-${input.orderId}.png`), {
        caption: orderQrisCaptionHtml(input),
        parse_mode: TELEGRAM_PARSE_MODE,
        reply_markup: unpaidOrderKeyboard(input.orderId, false),
      });
      return true;
    } catch (err: any) {
      this.logger.warn(
        `QRIS photo failed order=${input.orderId}: ${err?.message ?? err}`,
      );
      return false;
    }
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
      if (token.startsWith(INVITE_PREFIX)) {
        try {
          const name = [ctx.from?.first_name, ctx.from?.last_name]
            .filter(Boolean)
            .join(" ");
          const claimed = await this.invites.claim({
            token,
            telegramUserId: String(ctx.from?.id ?? ""),
            chatId,
            username: ctx.from?.username,
            name: name || undefined,
          });
          await this.replyHtml(ctx, inviteClaimPendingHtml(claimed.fullName));
        } catch (err: any) {
          await this.replyHtml(
            ctx,
            inviteFailedHtml(
              err?.status && err.status < 500
                ? String(err.message)
                : "Terjadi kesalahan. Coba lagi nanti.",
            ),
          );
        }
        return;
      }
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
          { reply_markup: adminMenuKeyboard() },
        );
        return;
      }
      await this.replyHtml(
        ctx,
        startLinkedMemberHtml({
          username: actor.user.username,
          balance: actor.user.creditBalance,
        }),
        { reply_markup: memberMenuKeyboard() },
      );
    });

    bot.command("menu", (ctx) => this.showMenu(ctx));
    bot.command("status", (ctx) => this.showStatus(ctx));
    bot.command("saldo", (ctx) => this.showSaldo(ctx));
    bot.command("order", (ctx) => this.showOrderPicker(ctx));
    bot.command("riwayat", (ctx) => this.showHistory(ctx));
    bot.command("rekap", (ctx) => this.showRecap(ctx));
    bot.command("cancel", (ctx) => this.handleSuperAdminCancelCommand(ctx));

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
        } else if (data.startsWith("ord:dskip:")) {
          await this.handleDoneSkip(ctx, data.slice("ord:dskip:".length));
        } else if (data.startsWith("ord:rs:")) {
          await this.handleDoneStatus(ctx, data.slice("ord:rs:".length));
        } else if (data.startsWith("uord:svc:")) {
          await this.handleUserServicePick(ctx, data.slice("uord:svc:".length));
        } else if (data.startsWith("uord:qris:")) {
          await this.handleUserShowQris(ctx, data.slice("uord:qris:".length));
        } else if (data.startsWith("uord:cancel:")) {
          await ctx.answerCallbackQuery();
          const orderId = data.slice("uord:cancel:".length);
          await this.replyHtml(ctx, cancelConfirmHtml(orderId), {
            reply_markup: cancelConfirmKeyboard(orderId),
          });
        } else if (data.startsWith("uord:cancelok:")) {
          await this.handleUserCancel(ctx, data.slice("uord:cancelok:".length));
        } else if (data.startsWith("sord:cancel:")) {
          const admin = await this.requireSuperAdmin(ctx);
          if (!admin) return;
          await ctx.answerCallbackQuery();
          const orderId = data.slice("sord:cancel:".length);
          await this.replyHtml(ctx, cancelConfirmHtml(orderId), {
            reply_markup: new InlineKeyboard()
              .text("✅ Ya, batalkan", `sord:cancelok:${orderId}`)
              .text("↩️ Tidak", `uord:keep:${orderId}`),
          });
        } else if (data.startsWith("sord:cancelok:")) {
          const admin = await this.requireSuperAdmin(ctx);
          if (!admin) return;
          const orderId = data.slice("sord:cancelok:".length);
          await this.orders.adminCancelOrder(admin.id, orderId);
          await ctx.answerCallbackQuery({ text: "Order dibatalkan" });
          await ctx
            .editMessageText(
              `🚫 Order <code>${escapeHtml(orderId)}</code> dibatalkan. User sudah diberi tahu.`,
              { parse_mode: TELEGRAM_PARSE_MODE },
            )
            .catch(() => undefined);
        } else if (data.startsWith("uord:keep:")) {
          await ctx.answerCallbackQuery({ text: "Order tetap aktif" });
          await ctx.deleteMessage().catch(() => undefined);
        } else if (data.startsWith("menu:")) {
          await this.handleMenuPick(ctx, data.slice("menu:".length));
        } else if (data.startsWith("inv:ok:") || data.startsWith("inv:no:")) {
          await this.handleInviteDecision(
            ctx,
            data.slice("inv:ok:".length),
            data.startsWith("inv:ok:"),
          );
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
          const amount = order.invoice?.amountDue ?? order.price;
          const invoice = order.invoice;
          if (invoice?.qrisString) {
            const sent = await this.replyQris(ctx, {
              orderId: order.orderId,
              qris: invoice.qrisString,
              amount,
              expiresAt: new Date(invoice.expiredAt),
            });
            if (sent) return;
          }
          const payUrl = `${webPublicUrl()}/app/order/${order.orderId}/bayar`;
          await this.replyHtml(
            ctx,
            orderCreatedHtml({ orderId: order.orderId, payUrl, amount }),
            { reply_markup: backToMenuKeyboard() },
          );
        } catch (err: any) {
          if (err instanceof ConflictException) {
            const pending = await this.orders
              .pendingOrder(session.userId)
              .catch(() => null);
            if (pending) {
              await this.replyPendingOrder(ctx, pending);
              return;
            }
          }
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

  private async showMenu(ctx: Context) {
    const actor = await this.requireMemberOrAdmin(ctx);
    if (!actor) return;
    if (actor.kind === "admin") {
      await this.replyHtml(
        ctx,
        "📍 <b>Menu admin</b>\nProses order lewat notifikasi Terima/Tolak/Done, atau pilih di bawah:",
        { reply_markup: adminMenuKeyboard() },
      );
      return;
    }
    await this.replyHtml(ctx, "📍 <b>Menu utama</b>\nPilih yang ingin dilakukan:", {
      reply_markup: memberMenuKeyboard(),
    });
  }

  private async handleMenuPick(ctx: Context, item: string) {
    await ctx.answerCallbackQuery();
    if (item === "order") return this.showOrderPicker(ctx);
    if (item === "riwayat") return this.showHistory(ctx);
    if (item === "saldo") return this.showSaldo(ctx);
    if (item === "status") return this.showStatus(ctx);
    if (item === "rekap") return this.showRecap(ctx);
    return this.showMenu(ctx);
  }

  private async showRecap(ctx: Context) {
    const actor = await this.requireMemberOrAdmin(ctx);
    if (!actor) return;
    if (actor.kind !== "admin") {
      await this.replyHtml(ctx, "Rekap order khusus admin.", {
        reply_markup: backToMenuKeyboard(),
      });
      return;
    }
    const html =
      actor.admin.role === "super_admin"
        ? superAdminRecapHtml(await this.recap.superAdmin())
        : operatorRecapHtml(await this.recap.operator(actor.admin.id));
    await this.replyHtml(ctx, html, { reply_markup: recapKeyboard() });
  }

  private async showStatus(ctx: Context) {
    const actor = await this.requireMemberOrAdmin(ctx);
    if (!actor) return;
    if (actor.kind === "admin") {
      await this.replyHtml(
        ctx,
        statusAdminHtml({
          username: actor.admin.username,
          role: actor.admin.role,
          status: actor.admin.status,
          portalUrl:
            actor.admin.role === "super_admin"
              ? `${webPublicUrl()}/admin`
              : undefined,
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
      { reply_markup: backToMenuKeyboard() },
    );
  }

  private async showSaldo(ctx: Context) {
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
      { reply_markup: backToMenuKeyboard() },
    );
  }

  private async showOrderPicker(ctx: Context) {
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
      const pending = await this.orders.pendingOrder(actor.user.id);
      if (pending) {
        await this.replyPendingOrder(ctx, pending);
        return;
      }
      const services = await this.orders.listServices(actor.user.id);
      if (!services.length) {
        await this.replyHtml(ctx, "Belum ada layanan aktif.", {
          reply_markup: backToMenuKeyboard(),
        });
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
      keyboard.text("⬅️ Menu", "menu:home");
      await this.replyHtml(ctx, "📦 <b>Buat order</b>\nPilih layanan:", {
        reply_markup: keyboard,
      });
    } catch (err: any) {
      await this.replyHtml(
        ctx,
        `⚠️ ${escapeHtml(err?.message ?? "Gagal memuat layanan")}`,
      );
    }
  }

  private async showHistory(ctx: Context) {
    const actor = await this.requireMemberOrAdmin(ctx);
    if (!actor) return;
    const rows =
      actor.kind === "admin"
        ? await this.orders.listAdminQueue(actor.admin.id, 5)
        : await this.orders.listRecentForUser(actor.user.id, 5);
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
      actor.kind === "member" ? { reply_markup: backToMenuKeyboard() } : {},
    );
  }

  private async handleAccept(ctx: Context, orderId: string) {
    const actor = await this.requireOperator(ctx);
    if (!actor) return;
    await this.orders.acceptOrder(actor.admin.id, orderId);
    await ctx.answerCallbackQuery({ text: "Order diambil" });
    await this.replyHtml(
      ctx,
      `🛠️ Anda mengambil <code>${escapeHtml(orderId)}</code>. Kerjakan lalu tekan Done.`,
    );
  }

  private async handleRejectStart(ctx: Context, orderId: string) {
    const actor = await this.requireOperator(ctx);
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
    const actor = await this.requireOperator(ctx);
    if (!actor) return;
    this.sessions.set(String(ctx.chat?.id ?? ""), {
      kind: "done_note",
      orderId,
      adminId: actor.admin.id,
      resultStatus: "success",
    });
    await ctx.answerCallbackQuery();
    await this.replyHtml(
      ctx,
      [
        `✅ Selesaikan order <code>${escapeHtml(orderId)}</code>`,
        "",
        "Kirim <b>catatan untuk user</b> (opsional), atau tekan <b>Lewati</b>.",
      ].join("\n"),
      {
        reply_markup: new InlineKeyboard().text(
          "⏭️ Lewati, tandai selesai",
          `ord:dskip:${orderId}`,
        ),
      },
    );
  }

  private async handleDoneSkip(ctx: Context, orderId: string) {
    const actor = await this.requireOperator(ctx);
    if (!actor) return;
    const chatId = String(ctx.chat?.id ?? "");
    const session = this.sessions.get(chatId);
    if (session?.kind === "done_note" && session.orderId === orderId) {
      this.sessions.delete(chatId);
    }
    await this.orders.completeOrder(actor.admin.id, orderId, {
      resultStatus: "success",
      resultNote: "",
    });
    await ctx.answerCallbackQuery({ text: "Order selesai" });
    await ctx
      .editMessageText(
        `✅ Order <code>${escapeHtml(orderId)}</code> selesai.`,
        { parse_mode: TELEGRAM_PARSE_MODE },
      )
      .catch(() => undefined);
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

  private async handleInviteDecision(
    ctx: Context,
    inviteId: string,
    approve: boolean,
  ) {
    const actor = await this.requireAdmin(ctx);
    if (!actor) return;
    if (actor.admin.role !== "super_admin") {
      await ctx.answerCallbackQuery({ text: "Khusus Super Admin", show_alert: true });
      return;
    }
    const decided = await this.invites.decide(actor.admin.id, inviteId, approve);
    await ctx.answerCallbackQuery({
      text: approve ? "Operator disetujui" : "Permintaan ditolak",
    });
    await ctx
      .editMessageText(inviteDecidedHtml(decided), {
        parse_mode: TELEGRAM_PARSE_MODE,
      })
      .catch(() => undefined);
  }

  private async replyPendingOrder(ctx: Context, order: SerializedOrder) {
    const invoice = order.invoice;
    await this.replyHtml(
      ctx,
      pendingOrderHtml({
        orderId: order.orderId,
        amount: invoice?.amountDue ?? order.price,
        expiresAt: invoice ? new Date(invoice.expiredAt) : null,
      }),
      { reply_markup: unpaidOrderKeyboard(order.orderId, Boolean(invoice?.qrisString)) },
    );
  }

  private async handleUserShowQris(ctx: Context, orderId: string) {
    const actor = await this.requireMember(ctx);
    if (!actor) return;
    const order = await this.orders.getOrder(actor.user.id, orderId);
    const invoice = order.invoice;
    if (order.status !== "waiting_payment" || !invoice?.qrisString) {
      await ctx.answerCallbackQuery({
        text: "Order ini sudah tidak menunggu pembayaran.",
        show_alert: true,
      });
      return;
    }
    await ctx.answerCallbackQuery();
    await this.replyQris(ctx, {
      orderId: order.orderId,
      qris: invoice.qrisString,
      amount: invoice.amountDue ?? order.price,
      expiresAt: new Date(invoice.expiredAt),
    });
  }

  private async handleUserCancel(ctx: Context, orderId: string) {
    const actor = await this.requireMember(ctx);
    if (!actor) return;
    await this.orders.cancelOrder(actor.user.id, orderId);
    await ctx.answerCallbackQuery({ text: "Order dibatalkan" });
    const html = [
      `🚫 Order <code>${escapeHtml(orderId)}</code> dibatalkan.`,
      "Ketik /order untuk membuat order baru.",
    ].join("\n");
    await ctx
      .editMessageText(html, {
        parse_mode: TELEGRAM_PARSE_MODE,
        reply_markup: backToMenuKeyboard(),
      })
      .catch(() =>
        this.replyHtml(ctx, html, { reply_markup: backToMenuKeyboard() }),
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

  private async requireSuperAdmin(ctx: Context) {
    const actor = await this.resolveActor(String(ctx.chat?.id ?? ""));
    if (actor?.kind === "admin" && actor.admin.role === "super_admin") {
      return actor.admin;
    }
    if (ctx.callbackQuery) {
      await ctx
        .answerCallbackQuery({ text: "Khusus Super Admin", show_alert: true })
        .catch(() => undefined);
    } else {
      await this.replyHtml(ctx, "Perintah ini khusus Super Admin.");
    }
    return null;
  }

  /** `/cancel ZT2609290001 alasan opsional` */
  private async handleSuperAdminCancelCommand(ctx: Context) {
    const admin = await this.requireSuperAdmin(ctx);
    if (!admin) return;
    const [orderId, ...rest] = String(ctx.match ?? "").trim().split(/\s+/);
    if (!orderId) {
      await this.replyHtml(
        ctx,
        "Format: <code>/cancel ZT2609290001 alasan</code>\nAlasan boleh dikosongkan.",
      );
      return;
    }
    try {
      await this.orders.adminCancelOrder(
        admin.id,
        orderId.toUpperCase(),
        rest.join(" ") || undefined,
      );
      await this.replyHtml(
        ctx,
        `🚫 Order <code>${escapeHtml(orderId.toUpperCase())}</code> dibatalkan. User sudah diberi tahu.`,
      );
    } catch (err: any) {
      await this.replyHtml(
        ctx,
        `⚠️ ${escapeHtml(err?.message ?? "Gagal membatalkan order")}`,
      );
    }
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

  /** Accepting and rejecting orders is operator work; Super Admin only monitors and cancels. */
  private async requireOperator(
    ctx: Context,
  ): Promise<Extract<TelegramActor, { kind: "admin" }> | null> {
    const actor = await this.requireAdmin(ctx);
    if (!actor) return null;
    if (actor.admin.role === "super_admin") {
      await ctx
        .answerCallbackQuery({
          text: "Order diproses oleh admin/operator. Super Admin hanya bisa membatalkan.",
          show_alert: true,
        })
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
