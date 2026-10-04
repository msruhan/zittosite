import {
  ConflictException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { Bot, Context, InlineKeyboard, InputFile } from "grammy";
import { run, sequentialize, type RunnerHandle } from "@grammyjs/runner";
import { descriptionToTelegramHtml } from "./telegram-description";
import * as QRCode from "qrcode";
import type { Admin, ResultStatus, User } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { webPublicUrl } from "../config/env";
import { OrdersService } from "../orders/orders.service";
import { TopupService, type SerializedTopup } from "../orders/topup.service";
import { TOPUP_PRESETS, parseTopupAmount, topupLimitMessage } from "../orders/topup-amount";
import { TelegramLinkTokenService } from "./telegram-link-token.service";
import { OrderRecapService, type SuperAdminRecap } from "./order-recap.service";
import {
  DAILY_RECAP_HOUR,
  DAILY_RECAP_MINUTE,
  msUntilJakartaTime,
} from "./daily-recap-schedule";
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
  adminOrderRecapHtml,
  orderCreatedHtml,
  orderPaidByBalanceHtml,
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
  topupPickHtml,
  topupQrisCaptionHtml,
  unlinkedHtml,
  type BulkItem,
} from "./telegram-messages";
import {
  INPUT_TYPE_LABEL,
  type InputType,
  parseImeiList,
} from "../orders/imei-list";
import { maxBulkFor } from "../orders/supplier-routed";
import { needsExtraInput } from "../orders/special-fields";
import { UserMenusService } from "../orders/user-menus.service";
import {
  ORDER_CATEGORIES,
  type OrderCategory,
  categoryLabel,
  categoryOfService,
  pageOf,
  parseOrderCategory,
} from "./order-picker";

type BotCommandDef = { command: string; description: string };

/** Default menu for every chat: customers and not-yet-linked chats. */
const MEMBER_COMMANDS: BotCommandDef[] = [
  { command: "start", description: "Mulai / status tautan" },
  { command: "menu", description: "Menu utama" },
  { command: "status", description: "Info akun tertaut" },
  { command: "saldo", description: "Cek saldo akun" },
  { command: "order", description: "Buat order baru" },
  { command: "riwayat", description: "5 order terakhir" },
  { command: "topup", description: "Topup saldo via QRIS" },
];

const OPERATOR_COMMANDS: BotCommandDef[] = [
  { command: "start", description: "Mulai / status tautan" },
  { command: "menu", description: "Menu utama" },
  { command: "status", description: "Info akun tertaut" },
  { command: "riwayat", description: "Antrean & order Anda" },
  { command: "rekap", description: "Rekap order Anda hari ini" },
];

const SUPER_ADMIN_COMMANDS: BotCommandDef[] = [
  { command: "start", description: "Mulai / status tautan" },
  { command: "menu", description: "Menu utama" },
  { command: "status", description: "Info akun tertaut" },
  { command: "riwayat", description: "Antrean order terbaru" },
  { command: "rekap", description: "Rekap order hari ini" },
  { command: "rekaporder", description: "Kirim rekap order ke tiap admin" },
  { command: "cancel", description: "Batalkan order: /cancel ZT… alasan" },
];

type CommandMenu = "member" | "operator" | "super_admin";

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
    .text("💳 Topup", "menu:topup")
    .row()
    .text("👤 Status", "menu:status");
}

function topupAmountKeyboard() {
  const keyboard = new InlineKeyboard();
  TOPUP_PRESETS.forEach((amount, i) => {
    keyboard.text(formatRp(amount), `top:amt:${amount}`);
    if (i % 2 === 1) keyboard.row();
  });
  return keyboard.text("✏️ Nominal lain", "top:custom").row().text("⬅️ Menu", "menu:home");
}

function pendingTopupKeyboard(invoiceId: string) {
  return new InlineKeyboard()
    .text("❌ Batalkan topup", `top:cancel:${invoiceId}`)
    .row()
    .text("⬅️ Menu", "menu:home");
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

/** Operators can only reject with no reason or this preset; Super Admin can type a custom one on the web. */
const REJECT_PRESET_REASON = "Eks Kemen / Roamer";

function rejectReasonKeyboard(orderId: string) {
  return new InlineKeyboard()
    .text("Tidak ada keterangan", `ord:rjn:${orderId}`)
    .row()
    .text(`📝 ${REJECT_PRESET_REASON}`, `ord:rjr:${orderId}`);
}

type ChatSession =
  | {
      kind: "done_note";
      orderId: string;
      adminId: string;
      resultStatus: ResultStatus;
    }
  | {
      kind: "user_imei";
      userId: string;
      serviceCode: string;
      serviceName: string;
      price: number;
      inputType: InputType;
      maxBulk: number;
    }
  | { kind: "topup_amount"; userId: string };

@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramBotService.name);
  private bot: Bot | null = null;
  private ready = false;
  private runner: RunnerHandle | null = null;
  private dailyRecapTimer: NodeJS.Timeout | null = null;
  private readonly seenUpdateIds = new Map<number, number>();
  private readonly sessions = new Map<string, ChatSession>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly linkTokens: TelegramLinkTokenService,
    private readonly orders: OrdersService,
    private readonly invites: AdminTelegramInviteService,
    private readonly recap: OrderRecapService,
    private readonly topups: TopupService,
    private readonly userMenus: UserMenusService,
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

    // grammY's default 500s request timeout lets one dropped connection stall a chat for minutes.
    this.bot = new Bot(token, { client: { timeoutSeconds: 60 } });
    // Updates run concurrently across chats but stay in order within a chat.
    this.bot.use(
      sequentialize((ctx) => (ctx.chat?.id ?? ctx.from?.id)?.toString()),
    );
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
      await this.bot.api.setMyCommands(MEMBER_COMMANDS);
    } catch (err) {
      this.logger.warn(
        `setMyCommands failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    void this.syncAdminCommandMenus();
    this.scheduleDailyRecap();

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
      this.runner = run(this.bot);
      this.logger.log("Telegram bot polling started");
    } else {
      this.logger.log("Telegram bot in webhook mode");
    }
  }

  async onModuleDestroy() {
    this.ready = false;
    if (this.dailyRecapTimer) clearTimeout(this.dailyRecapTimer);
    if (this.runner?.isRunning()) await this.runner.stop();
  }

  /** Production (or TELEGRAM_DAILY_RECAP=1): recaps go out every day at 23.00 WIB. */
  private scheduleDailyRecap() {
    const enabled =
      process.env.TELEGRAM_DAILY_RECAP === "1" ||
      (process.env.NODE_ENV === "production" && process.env.TELEGRAM_DAILY_RECAP !== "0");
    if (!enabled) return;
    const delay = msUntilJakartaTime(new Date(), DAILY_RECAP_HOUR, DAILY_RECAP_MINUTE);
    this.dailyRecapTimer = setTimeout(() => {
      void this.sendDailyRecaps()
        .catch((err) =>
          this.logger.error(
            `daily recap failed: ${err instanceof Error ? err.message : String(err)}`,
          ),
        )
        .finally(() => this.scheduleDailyRecap());
    }, delay);
    this.logger.log(`Daily recap scheduled in ${Math.round(delay / 60_000)} min`);
  }

  /** Each admin gets their own recap; every linked Super Admin gets the full one. */
  async sendDailyRecaps() {
    if (!this.bot) return;
    const recap = await this.recap.superAdmin();
    const delivery = await this.deliverAdminRecaps(recap);

    const superAdmins = await this.prisma.admin.findMany({
      where: {
        role: "super_admin",
        status: "active",
        telegramChatId: { not: null },
        telegramLinkedAt: { not: null },
      },
      select: { id: true, telegramChatId: true },
    });
    const summary = [
      `📤 <b>Rekap otomatis 23.00 WIB dikirim ke ${delivery.sent} dari ${delivery.total} admin</b>`,
      ...(delivery.report.length ? ["", ...delivery.report] : []),
    ].join("\n");
    for (const admin of superAdmins) {
      try {
        await this.bot.api.sendMessage(admin.telegramChatId!, superAdminRecapHtml(recap), {
          parse_mode: TELEGRAM_PARSE_MODE,
          link_preview_options: { is_disabled: true },
        });
        if (delivery.total > 0) {
          await this.bot.api.sendMessage(admin.telegramChatId!, summary, {
            parse_mode: TELEGRAM_PARSE_MODE,
          });
        }
      } catch (err) {
        this.logger.warn(
          `daily recap to super admin ${admin.id} failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    this.logger.log(
      `Daily recap sent: ${delivery.sent}/${delivery.total} admins, ${superAdmins.length} super admins`,
    );
  }

  /** Sends each admin who handled orders today their own recap; returns a per-admin report. */
  private async deliverAdminRecaps(recap: SuperAdminRecap) {
    const withOrders = recap.perAdmin.filter((a) => a.orders.length > 0);
    const report: string[] = [];
    let sent = 0;
    if (!this.bot || !withOrders.length) return { sent, total: withOrders.length, report };

    const chats = new Map(
      (
        await this.prisma.admin.findMany({
          where: {
            id: { in: withOrders.map((a) => a.adminId) },
            status: "active",
            telegramChatId: { not: null },
            telegramLinkedAt: { not: null },
          },
          select: { id: true, telegramChatId: true },
        })
      ).map((a) => [a.id, a.telegramChatId!]),
    );

    for (const admin of withOrders) {
      const label = `<b>${escapeHtml(admin.fullName)}</b> (${admin.orders.length} order)`;
      const chatId = chats.get(admin.adminId);
      if (!chatId) {
        report.push(`⚠️ ${label} — Telegram belum tertaut`);
        continue;
      }
      try {
        await this.bot.api.sendMessage(
          chatId,
          adminOrderRecapHtml({ day: recap.day, ...admin }),
          { parse_mode: TELEGRAM_PARSE_MODE, link_preview_options: { is_disabled: true } },
        );
        sent += 1;
        report.push(`✅ ${label}`);
      } catch (err) {
        this.logger.warn(
          `admin recap send failed admin=${admin.adminId}: ${err instanceof Error ? err.message : String(err)}`,
        );
        report.push(`❌ ${label} — gagal terkirim`);
      }
    }
    return { sent, total: withOrders.length, report };
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
    input: {
      orderId: string;
      qris: string;
      amount: number;
      balanceUsed?: number;
      expiresAt: Date;
      items?: BulkItem[];
    },
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
    bot.command("topup", (ctx) => this.showTopup(ctx));
    bot.command("rekap", (ctx) => this.showRecap(ctx));
    bot.command("rekaporder", (ctx) => this.sendAdminRecaps(ctx));
    bot.command("cancel", (ctx) => this.handleSuperAdminCancelCommand(ctx));

    bot.on("callback_query:data", async (ctx) => {
      const data = ctx.callbackQuery.data ?? "";
      const chatId = String(ctx.chat?.id ?? ctx.from?.id ?? "");
      try {
        if (data.startsWith("ord:accept:")) {
          await this.handleAccept(ctx, data.slice("ord:accept:".length));
        } else if (data.startsWith("ord:reject:")) {
          await this.handleRejectStart(ctx, data.slice("ord:reject:".length));
        } else if (data.startsWith("ord:rjn:")) {
          await this.handleRejectConfirm(ctx, data.slice("ord:rjn:".length));
        } else if (data.startsWith("ord:rjr:")) {
          await this.handleRejectConfirm(
            ctx,
            data.slice("ord:rjr:".length),
            REJECT_PRESET_REASON,
          );
        } else if (data.startsWith("ord:done:")) {
          await this.handleDoneStart(ctx, data.slice("ord:done:".length));
        } else if (data.startsWith("ord:dskip:")) {
          await this.handleDoneSkip(ctx, data.slice("ord:dskip:".length));
        } else if (data.startsWith("ord:rs:")) {
          await this.handleDoneStatus(ctx, data.slice("ord:rs:".length));
        } else if (data === "uord:cats") {
          await this.showOrderPicker(ctx, true);
        } else if (data.startsWith("uord:cat:")) {
          const [rawKey, rawPage] = data.slice("uord:cat:".length).split(":");
          const key = parseOrderCategory(rawKey ?? "");
          if (key) await this.showOrderCategory(ctx, key, Number(rawPage));
          else await ctx.answerCallbackQuery();
        } else if (data.startsWith("uord:grp:")) {
          const [groupKey, rawPage] = data.slice("uord:grp:".length).split(":");
          await this.showSpecialGroup(ctx, groupKey ?? "", Number(rawPage));
        } else if (data.startsWith("uord:svc:")) {
          await this.handleUserServicePick(ctx, data.slice("uord:svc:".length));
        } else if (data.startsWith("uord:qris:")) {
          await this.handleUserShowQris(ctx, data.slice("uord:qris:".length));
        } else if (data.startsWith("uord:cancel:")) {
          await ctx.answerCallbackQuery();
          const orderId = data.slice("uord:cancel:".length);
          const bulk = await this.unpaidBulkSize(orderId);
          await this.replyHtml(ctx, cancelConfirmHtml(orderId, bulk), {
            reply_markup: cancelConfirmKeyboard(orderId),
          });
        } else if (data.startsWith("uord:cancelok:")) {
          await this.handleUserCancel(ctx, data.slice("uord:cancelok:".length));
        } else if (data.startsWith("sord:cancel:")) {
          const admin = await this.requireSuperAdmin(ctx);
          if (!admin) return;
          await ctx.answerCallbackQuery();
          const orderId = data.slice("sord:cancel:".length);
          const bulk = await this.unpaidBulkSize(orderId);
          await this.replyHtml(ctx, cancelConfirmHtml(orderId, bulk), {
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
        } else if (data.startsWith("top:amt:")) {
          await ctx.answerCallbackQuery();
          await this.startTopup(ctx, data.slice("top:amt:".length));
        } else if (data === "top:custom") {
          const actor = await this.requireMember(ctx);
          if (!actor) return;
          this.sessions.set(chatId, { kind: "topup_amount", userId: actor.user.id });
          await ctx.answerCallbackQuery();
          await this.replyHtml(
            ctx,
            `Ketik nominal topup, misalnya <code>150000</code>.\n${escapeHtml(topupLimitMessage())}`,
          );
        } else if (data.startsWith("top:cancel:")) {
          const actor = await this.requireMember(ctx);
          if (!actor) return;
          const invoiceId = data.slice("top:cancel:".length);
          await this.topups.cancel(actor.user.id, invoiceId);
          await ctx.answerCallbackQuery({ text: "Topup dibatalkan" });
          const html = `🚫 Topup <code>${escapeHtml(invoiceId)}</code> dibatalkan.`;
          await ctx
            .editMessageCaption({ caption: html, parse_mode: TELEGRAM_PARSE_MODE })
            .catch(() => this.replyHtml(ctx, html, { reply_markup: backToMenuKeyboard() }));
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

      if (session.kind === "topup_amount") {
        if (parseTopupAmount(text) === null) {
          await this.replyHtml(
            ctx,
            `⚠️ ${escapeHtml(topupLimitMessage())} Ketik angka saja, misalnya <code>150000</code>.`,
          );
          return;
        }
        this.sessions.delete(chatId);
        await this.startTopup(ctx, text);
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
        const parsed = parseImeiList(text, session.inputType, session.maxBulk);
        if (!parsed.ok) {
          await this.replyHtml(
            ctx,
            [
              ...parsed.errors.map((e) => `⚠️ ${escapeHtml(e)}`),
              "",
              `Kirim ulang ${INPUT_TYPE_LABEL[session.inputType]}, satu per baris (maksimal ${session.maxBulk}).`,
            ].join("\n"),
          );
          return;
        }
        this.sessions.delete(chatId);
        try {
          const order = await this.orders.createOrder(session.userId, {
            serviceCode: session.serviceCode,
            imeis: parsed.imeis,
            channel: "telegram",
          });
          const invoice = order.invoice;
          const amount = invoice?.amountDue ?? invoice?.amount ?? order.price;
          const balanceUsed = invoice?.balanceUsed ?? 0;
          const items = invoice?.orders;
          if (order.status !== "waiting_payment") {
            await this.replyHtml(
              ctx,
              orderPaidByBalanceHtml({
                orderId: order.orderId,
                amount: invoice?.amount ?? order.price,
                items,
              }),
              { reply_markup: backToMenuKeyboard() },
            );
            return;
          }
          if (invoice?.qrisString) {
            const sent = await this.replyQris(ctx, {
              orderId: order.orderId,
              qris: invoice.qrisString,
              amount,
              balanceUsed,
              expiresAt: new Date(invoice.expiredAt),
              items,
            });
            if (sent) return;
          }
          const payUrl = `${webPublicUrl()}/app/order/${order.orderId}/bayar`;
          await this.replyHtml(
            ctx,
            orderCreatedHtml({
              orderId: order.orderId,
              payUrl,
              amount,
              balanceUsed,
              items,
            }),
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
    if (item === "topup") return this.showTopup(ctx);
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

  /** Super Admin: send every admin who handled orders today their own recap. */
  private async sendAdminRecaps(ctx: Context) {
    const superAdmin = await this.requireSuperAdmin(ctx);
    if (!superAdmin || !this.bot) return;

    const { sent, total, report } = await this.deliverAdminRecaps(await this.recap.superAdmin());
    if (!total) {
      await this.replyHtml(ctx, "📭 Belum ada order yang ditangani admin hari ini.");
      return;
    }
    await this.replyHtml(
      ctx,
      [`📤 <b>Rekap order dikirim ke ${sent} dari ${total} admin</b>`, "", ...report].join("\n"),
    );
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
      {
        reply_markup: new InlineKeyboard()
          .text("💳 Topup", "menu:topup")
          .text("⬅️ Menu", "menu:home"),
      },
    );
  }

  private async showTopup(ctx: Context) {
    const actor = await this.requireMemberOrAdmin(ctx);
    if (!actor) return;
    if (actor.kind === "admin") {
      await this.replyHtml(ctx, "Topup saldo khusus akun user.");
      return;
    }
    const pending = await this.topups.pending(actor.user.id);
    if (pending) {
      await this.replyTopupQris(ctx, pending);
      return;
    }
    await this.replyHtml(ctx, topupPickHtml(actor.user.creditBalance), {
      reply_markup: topupAmountKeyboard(),
    });
  }

  private async startTopup(ctx: Context, rawAmount: string) {
    const actor = await this.requireMember(ctx);
    if (!actor) return;
    try {
      const { topup, created } = await this.topups.create(
        actor.user.id,
        rawAmount,
        "telegram",
      );
      if (!created) {
        await this.replyHtml(
          ctx,
          "⏳ Masih ada topup yang menunggu pembayaran. Selesaikan atau batalkan dulu:",
        );
      }
      await this.replyTopupQris(ctx, topup);
    } catch (err: any) {
      await this.replyHtml(ctx, `⚠️ ${escapeHtml(err?.message ?? "Gagal membuat topup")}`, {
        reply_markup: backToMenuKeyboard(),
      });
    }
  }

  /** QRIS photo for a pending topup, falling back to the web payment page. */
  private async replyTopupQris(ctx: Context, topup: SerializedTopup) {
    const caption = topupQrisCaptionHtml({
      invoiceId: topup.invoiceId,
      amount: topup.amount,
      amountDue: topup.amountDue,
      expiresAt: new Date(topup.expiredAt),
    });
    if (topup.qrisString) {
      try {
        const png = await QRCode.toBuffer(topup.qrisString, {
          type: "png",
          width: 720,
          margin: 3,
          errorCorrectionLevel: "M",
        });
        await ctx.replyWithPhoto(new InputFile(png, `QRIS-${topup.invoiceId}.png`), {
          caption,
          parse_mode: TELEGRAM_PARSE_MODE,
          reply_markup: pendingTopupKeyboard(topup.invoiceId),
        });
        return;
      } catch (err: any) {
        this.logger.warn(`Topup QRIS photo failed ${topup.invoiceId}: ${err?.message ?? err}`);
      }
    }
    await this.replyHtml(
      ctx,
      [caption, "", "Bayar di portal:", escapeHtml(`${webPublicUrl()}/app/topup/${topup.invoiceId}`)].join("\n"),
      { reply_markup: pendingTopupKeyboard(topup.invoiceId) },
    );
  }

  /** Services orderable in the bot: those needing website-only extra fields are left out. */
  private async botServices(userId: string) {
    return (await this.orders.listServices(userId)).filter((service) => !needsExtraInput(service));
  }

  /** Callback navigation edits the picker in place; commands send a new message. */
  private async sendOrEdit(ctx: Context, html: string, keyboard: InlineKeyboard, edit: boolean) {
    if (edit && ctx.callbackQuery) {
      await ctx.answerCallbackQuery().catch(() => undefined);
      const edited = await ctx
        .editMessageText(html, { parse_mode: TELEGRAM_PARSE_MODE, reply_markup: keyboard })
        .then(() => true)
        .catch(() => false);
      if (edited) return;
    }
    await this.replyHtml(ctx, html, { reply_markup: keyboard });
  }

  private async showOrderCategory(ctx: Context, key: OrderCategory, page: number) {
    const actor = await this.requireMember(ctx);
    if (!actor) return;
    const [services, menus] = await Promise.all([
      this.botServices(actor.user.id),
      this.userMenus.get(),
    ]);
    const inCategory = services
      .filter((service) => categoryOfService(service) === key)
      .sort(
        (a, b) =>
          (a.group ?? "").localeCompare(b.group ?? "") || a.name.localeCompare(b.name),
      );
    if (!inCategory.length) {
      await ctx.answerCallbackQuery({ text: "Belum ada layanan di kategori ini", show_alert: true });
      return;
    }
    if (key === "special" && inCategory.some((service) => service.groupId)) {
      await this.showSpecialGroups(ctx, inCategory, categoryLabel(key, menus), page);
      return;
    }
    await this.showServiceList(ctx, {
      title: categoryLabel(key, menus),
      services: inCategory,
      page,
      pageData: (p) => `uord:cat:${key}:${p}`,
      back: ["⬅️ Jenis layanan", "uord:cats"],
    });
  }

  /** Layanan Spesial first asks for a group (as set in Grup Layanan Spesial), then lists its services. */
  private async showSpecialGroups(
    ctx: Context,
    services: Array<{ group: string | null; groupId: string | null }>,
    title: string,
    page: number,
  ) {
    const groups = new Map<string, { name: string; count: number }>();
    let ungrouped = 0;
    for (const service of services) {
      if (!service.groupId) {
        ungrouped += 1;
        continue;
      }
      const entry = groups.get(service.groupId);
      if (entry) entry.count += 1;
      else groups.set(service.groupId, { name: service.group ?? "Grup", count: 1 });
    }
    const options = [
      ...[...groups.entries()]
        .sort(([, a], [, b]) => a.name.localeCompare(b.name))
        .map(([id, g]) => ({ key: id, label: `${g.name} (${g.count})` })),
      ...(ungrouped ? [{ key: "none", label: `Lainnya (${ungrouped})` }] : []),
    ];
    const view = pageOf(options, page);
    const keyboard = new InlineKeyboard();
    for (const option of view.items) keyboard.text(option.label, `uord:grp:${option.key}`).row();
    if (view.pages > 1) {
      if (view.page > 1) keyboard.text("◀️ Sebelumnya", `uord:cat:special:${view.page - 1}`);
      if (view.page < view.pages) keyboard.text("Berikutnya ▶️", `uord:cat:special:${view.page + 1}`);
      keyboard.row();
    }
    keyboard.text("⬅️ Jenis layanan", "uord:cats").text("🏠 Menu", "menu:home");
    await this.sendOrEdit(
      ctx,
      `📦 <b>${escapeHtml(title)}</b>\nPilih grup layanan (${services.length} layanan):`,
      keyboard,
      true,
    );
  }

  private async showSpecialGroup(ctx: Context, groupKey: string, page: number) {
    const actor = await this.requireMember(ctx);
    if (!actor) return;
    const [services, menus] = await Promise.all([
      this.botServices(actor.user.id),
      this.userMenus.get(),
    ]);
    const inGroup = services
      .filter(
        (service) =>
          categoryOfService(service) === "special" &&
          (groupKey === "none" ? !service.groupId : service.groupId === groupKey),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
    if (!inGroup.length) {
      await ctx.answerCallbackQuery({ text: "Belum ada layanan di grup ini", show_alert: true });
      return;
    }
    const groupName = groupKey === "none" ? "Lainnya" : inGroup[0].group ?? "Grup";
    await this.showServiceList(ctx, {
      title: `${categoryLabel("special", menus)} › ${groupName}`,
      services: inGroup,
      page,
      pageData: (p) => `uord:grp:${groupKey}:${p}`,
      back: ["⬅️ Grup layanan", "uord:cat:special"],
    });
  }

  private async showServiceList(
    ctx: Context,
    input: {
      title: string;
      services: Array<{ id: string; code: string | null; name: string; price: number }>;
      page: number;
      pageData: (page: number) => string;
      back: [label: string, data: string];
    },
  ) {
    const view = pageOf(input.services, input.page);
    const keyboard = new InlineKeyboard();
    for (const service of view.items) {
      keyboard
        .text(`${service.name} — ${formatRp(service.price)}`, `uord:svc:${service.code ?? service.id}`)
        .row();
    }
    if (view.pages > 1) {
      if (view.page > 1) keyboard.text("◀️ Sebelumnya", input.pageData(view.page - 1));
      if (view.page < view.pages) keyboard.text("Berikutnya ▶️", input.pageData(view.page + 1));
      keyboard.row();
    }
    keyboard.text(input.back[0], input.back[1]).text("🏠 Menu", "menu:home");
    const pageNote = view.pages > 1 ? ` · halaman ${view.page}/${view.pages}` : "";
    await this.sendOrEdit(
      ctx,
      `📦 <b>${escapeHtml(input.title)}</b>\nPilih layanan (${input.services.length}${pageNote}):`,
      keyboard,
      true,
    );
  }

  private async showOrderPicker(ctx: Context, edit = false) {
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
      const [services, menus] = await Promise.all([
        this.botServices(actor.user.id),
        this.userMenus.get(),
      ]);
      if (!services.length) {
        await this.replyHtml(ctx, "Belum ada layanan aktif.", {
          reply_markup: backToMenuKeyboard(),
        });
        return;
      }
      const counts = new Map<OrderCategory, number>();
      for (const service of services) {
        const key = categoryOfService(service);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      const keyboard = new InlineKeyboard();
      for (const key of ORDER_CATEGORIES) {
        const count = counts.get(key);
        if (count) keyboard.text(`${categoryLabel(key, menus)} (${count})`, `uord:cat:${key}:1`).row();
      }
      keyboard.text("⬅️ Menu", "menu:home");
      await this.sendOrEdit(ctx, "📦 <b>Buat order</b>\nPilih jenis layanan:", keyboard, edit);
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
    const order = await this.orders.acceptOrder(actor.admin.id, orderId);
    await ctx.answerCallbackQuery({ text: "Order diambil" });
    await this.replyHtml(
      ctx,
      [
        `🛠️ Anda mengambil <code>${escapeHtml(orderId)}</code>.`,
        `📱 IMEI: <code>${escapeHtml(order.imei)}</code>`,
        "Kerjakan lalu tekan Done.",
      ].join("\n"),
      {
        reply_markup: new InlineKeyboard()
          .text("✅ Done", `ord:done:${orderId}`)
          .text("❌ Tolak", `ord:reject:${orderId}`),
      },
    );
  }

  private async handleRejectStart(ctx: Context, orderId: string) {
    const actor = await this.requireOperator(ctx);
    if (!actor) return;
    await ctx.answerCallbackQuery();
    await this.replyHtml(
      ctx,
      `Tambahkan <b>keterangan penolakan</b> untuk <code>${escapeHtml(orderId)}</code>?`,
      { reply_markup: rejectReasonKeyboard(orderId) },
    );
  }

  private async handleRejectConfirm(
    ctx: Context,
    orderId: string,
    reason?: string,
  ) {
    const actor = await this.requireOperator(ctx);
    if (!actor) return;
    const order = await this.orders.rejectOrder(actor.admin.id, orderId, reason);
    await ctx.answerCallbackQuery({ text: "Order ditolak" });
    const html = [
      `❌ Order <code>${escapeHtml(orderId)}</code> ditolak.`,
      `📱 IMEI: <code>${escapeHtml(order.imei)}</code>`,
      `📝 Keterangan: ${reason ? escapeHtml(reason) : "<i>tidak ada</i>"}`,
    ].join("\n");
    await ctx
      .editMessageText(html, { parse_mode: TELEGRAM_PARSE_MODE })
      .catch(() => this.replyHtml(ctx, html));
  }

  private async handleDoneStart(ctx: Context, orderId: string) {
    const actor = await this.requireOperator(ctx);
    if (!actor) return;
    const order = await this.orders.completeOrder(actor.admin.id, orderId, {
      resultStatus: "success",
      resultNote: "",
    });
    await ctx.answerCallbackQuery({ text: "Order selesai" });
    await this.replyHtml(
      ctx,
      [
        `✅ Order <code>${escapeHtml(orderId)}</code> selesai.`,
        `📱 IMEI: <code>${escapeHtml(order.imei)}</code>`,
        "User sudah diberi tahu.",
      ].join("\n"),
    );
  }

  /** Older "Lewati" buttons from the previous note prompt. */
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
    if (!["success", "failed"].includes(resultStatus)) {
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

  /** How many unpaid orders share this order's QRIS (cancelling one cancels them all). */
  private async unpaidBulkSize(orderId: string): Promise<number> {
    const order = await this.prisma.order.findUnique({
      where: { orderId },
      select: { invoiceId: true, status: true },
    });
    if (!order?.invoiceId || order.status !== "waiting_payment") return 1;
    return this.prisma.order.count({
      where: { invoiceId: order.invoiceId, status: "waiting_payment" },
    });
  }

  private async replyPendingOrder(ctx: Context, order: SerializedOrder) {
    const invoice = order.invoice;
    await this.replyHtml(
      ctx,
      pendingOrderHtml({
        orderId: order.orderId,
        amount: invoice?.amountDue ?? invoice?.amount ?? order.price,
        balanceUsed: invoice?.balanceUsed,
        expiresAt: invoice ? new Date(invoice.expiredAt) : null,
        items: invoice?.orders,
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
      amount: invoice.amountDue ?? invoice.amount,
      balanceUsed: invoice.balanceUsed,
      expiresAt: new Date(invoice.expiredAt),
      items: invoice.orders,
    });
  }

  private async handleUserCancel(ctx: Context, orderId: string) {
    const actor = await this.requireMember(ctx);
    if (!actor) return;
    const cancelled = await this.orders.cancelOrder(actor.user.id, orderId);
    await ctx.answerCallbackQuery({ text: "Order dibatalkan" });
    const ids = cancelled.invoice?.orders.map((o) => o.orderId) ?? [orderId];
    const html = [
      `🚫 Order ${ids.map((id) => `<code>${escapeHtml(id)}</code>`).join(", ")} dibatalkan.`,
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
    if (service.inputType === "none" || needsExtraInput(service)) {
      await ctx.answerCallbackQuery({
        text: "Layanan ini butuh data tambahan dan hanya bisa dipesan lewat website.",
        show_alert: true,
      });
      return;
    }
    const inputType = service.inputType;
    const maxBulk = maxBulkFor({ fulfillmentChannel: service.via, menu: service.menu ?? "ceir" });
    const chatId = String(ctx.chat?.id ?? "");
    this.sessions.set(chatId, {
      kind: "user_imei",
      userId: actor.user.id,
      serviceCode: service.code ?? serviceCode,
      serviceName: service.name,
      price: service.price,
      inputType,
      maxBulk,
    });
    const label = INPUT_TYPE_LABEL[inputType];
    const inputLabel = service.inputType === "imei" ? "IMEI 15 digit" : `${label} perangkat`;
    const description = descriptionToTelegramHtml(service.description);
    await ctx.answerCallbackQuery();
    await this.replyHtml(
      ctx,
      [
        `📦 <b>${escapeHtml(service.name)}</b>`,
        `💰 Harga: <b>${formatRp(service.price)}</b>`,
        "",
        description
          ? `<blockquote>${description}</blockquote>\n\n✍️ Kirim <b>${escapeHtml(inputLabel)}</b> untuk melanjutkan.`
          : `Silahkan Masukan <b>${escapeHtml(inputLabel)}</b>.`,
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
    if (admin) {
      this.ensureCommandMenu(
        chatId,
        admin.role === "super_admin" ? "super_admin" : "operator",
      );
      return { kind: "admin", admin };
    }

    this.ensureCommandMenu(chatId, "member");
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

  /** Per-chat "/" menus so each role only sees the commands it can use. */
  private readonly commandMenus = new Map<string, CommandMenu>();

  private ensureCommandMenu(chatId: string, menu: CommandMenu) {
    if (!chatId || this.commandMenus.get(chatId) === menu) return;
    this.commandMenus.set(chatId, menu);
    void this.applyCommandMenu(chatId, menu);
  }

  private async applyCommandMenu(chatId: string, menu: CommandMenu) {
    if (!this.bot) return;
    const scope = { type: "chat" as const, chat_id: Number(chatId) };
    try {
      if (menu === "member") {
        await this.bot.api.deleteMyCommands({ scope });
      } else {
        await this.bot.api.setMyCommands(
          menu === "super_admin" ? SUPER_ADMIN_COMMANDS : OPERATOR_COMMANDS,
          { scope },
        );
      }
    } catch (err) {
      this.commandMenus.delete(chatId);
      this.logger.warn(
        `command menu sync failed chat=${chatId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async syncAdminCommandMenus() {
    try {
      const admins = await this.prisma.admin.findMany({
        where: { status: "active", telegramChatId: { not: null } },
        select: { role: true, telegramChatId: true },
      });
      for (const admin of admins) {
        this.ensureCommandMenu(
          admin.telegramChatId!,
          admin.role === "super_admin" ? "super_admin" : "operator",
        );
      }
    } catch (err) {
      this.logger.warn(
        `admin command menu sync failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
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

  /** Order work (take, reject, Done); a Super Admin may also take manual-service orders. */
  private async requireOperator(
    ctx: Context,
  ): Promise<Extract<TelegramActor, { kind: "admin" }> | null> {
    return this.requireAdmin(ctx);
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
