import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { OrdersService } from "../orders/orders.service";
import { AdminNotifyService } from "../telegram/admin-notify.service";
import { GobizClient, type GobizTransaction } from "./gobiz.client";
import { GobizSessionService } from "./gobiz-session.service";

const POLL_MS = 20_000;
const KEEPALIVE_MS = 6 * 60 * 60 * 1000;
const LOOKBACK_MS = 2 * 60 * 1000;
const FAILURE_ALERT_THRESHOLD = 10;
const SETTLEABLE = new Set(["QRIS", "GOPAY"]);

export type GobizPollerStatus = {
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;
};

@Injectable()
export class GobizPollerWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GobizPollerWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private lastRunAt: Date | null = null;
  private lastSuccessAt: Date | null = null;
  private lastError: string | null = null;
  private consecutiveFailures = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: GobizClient,
    private readonly session: GobizSessionService,
    private readonly orders: OrdersService,
    private readonly adminNotify: AdminNotifyService,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === "test") return;
    this.timer = setInterval(() => void this.tick(), POLL_MS);
    void this.tick();
    this.logger.log(`GoBiz listener started (interval ${POLL_MS}ms)`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  status(): GobizPollerStatus {
    return {
      lastRunAt: this.lastRunAt?.toISOString() ?? null,
      lastSuccessAt: this.lastSuccessAt?.toISOString() ?? null,
      lastError: this.lastError,
      consecutiveFailures: this.consecutiveFailures,
    };
  }

  async tick(): Promise<{ processed: number } | null> {
    if (this.running) return null;
    this.running = true;
    this.lastRunAt = new Date();
    try {
      await this.session.refreshIfOlderThan(KEEPALIVE_MS);
      const processed = await this.pollPending();
      this.lastSuccessAt = new Date();
      this.lastError = null;
      this.consecutiveFailures = 0;
      return { processed };
    } catch (err) {
      this.recordFailure(err);
      return null;
    } finally {
      this.running = false;
    }
  }

  private async pollPending(): Promise<number> {
    const oldest = await this.prisma.paymentInvoice.findFirst({
      where: { paymentChannel: "listener", paymentStatus: "pending", amountDue: { not: null } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });
    if (!oldest) return 0;

    const since = new Date(oldest.createdAt.getTime() - LOOKBACK_MS);
    const transactions = await this.session.withToken((token, merchantId, deviceId) =>
      this.client.listTransactions(token, merchantId, deviceId, since),
    );
    if (!transactions) return 0;

    const fresh = await this.filterUnprocessed(transactions);
    fresh.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
    for (const tx of fresh) await this.process(tx);
    return fresh.length;
  }

  private async filterUnprocessed(transactions: GobizTransaction[]): Promise<GobizTransaction[]> {
    const candidates = transactions.filter((tx) => SETTLEABLE.has(tx.paymentType));
    if (!candidates.length) return [];
    const known = await this.prisma.gobizTransaction.findMany({
      where: { id: { in: candidates.map((tx) => tx.id) } },
      select: { id: true },
    });
    const knownIds = new Set(known.map((row) => row.id));
    return candidates.filter((tx) => !knownIds.has(tx.id));
  }

  private async process(tx: GobizTransaction) {
    const result = await this.orders.settleListenerPayment({
      amount: tx.amount,
      transactionId: tx.id,
      occurredAt: tx.occurredAt,
      payload: tx.raw as Prisma.InputJsonValue,
    });
    try {
      await this.prisma.gobizTransaction.create({
        data: {
          id: tx.id,
          amount: tx.amount,
          paymentType: tx.paymentType || null,
          occurredAt: tx.occurredAt,
          status: result.status,
          invoiceId: result.invoiceId ?? null,
          raw: tx.raw as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      if ((err as { code?: string }).code !== "P2002") throw err;
    }
    if (result.status === "matched") {
      this.logger.log(`GoBiz trx ${tx.id} settled invoice ${result.invoiceId}`);
    } else if (result.status === "unmatched") {
      void this.adminNotify
        .notify(
          `⚠️ Listener VPS: pembayaran Rp ${tx.amount.toLocaleString("id-ID")} tidak cocok dengan invoice yang menunggu.`,
        )
        .catch(() => undefined);
    }
  }

  private recordFailure(err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    this.lastError = message;
    this.consecutiveFailures += 1;
    this.logger.error(`GoBiz poll failed (${this.consecutiveFailures}x): ${message}`);
    if (this.consecutiveFailures === FAILURE_ALERT_THRESHOLD) {
      void this.adminNotify
        .notify(`⚠️ Listener VPS gagal ${FAILURE_ALERT_THRESHOLD}x berturut-turut: ${message.slice(0, 200)}`)
        .catch(() => undefined);
    }
  }
}
