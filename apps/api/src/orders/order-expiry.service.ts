import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { OrdersService } from "./orders.service";

const SWEEP_INTERVAL_MS = 60_000;

/** Cancels unpaid orders once their invoice deadline passes, even if nobody opens them. */
@Injectable()
export class OrderExpiryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderExpiryService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly orders: OrdersService) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.sweep(), SWEEP_INTERVAL_MS);
    this.timer.unref();
    void this.sweep();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async sweep() {
    if (this.running) return;
    this.running = true;
    try {
      const expired = await this.orders.expireOverdueOrders();
      if (expired) this.logger.log(`Expired ${expired} unpaid order(s)`);
    } catch (err) {
      this.logger.warn(
        `Expiry sweep failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      this.running = false;
    }
  }
}
