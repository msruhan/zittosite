import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { whatsappConfig } from "../config/env";
import { WhatsappNotifyService } from "./whatsapp-notify.service";

const SWEEP_INTERVAL_MS = 60_000;
const BATCH_SIZE = 20;

/** Resends queued WhatsApp group messages whose previous attempt failed. */
@Injectable()
export class WhatsappRetryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsappRetryService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly notify: WhatsappNotifyService) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.sweep(), SWEEP_INTERVAL_MS);
    this.timer.unref();
    void this.sweep();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async sweep() {
    if (this.running || !whatsappConfig()) return;
    this.running = true;
    try {
      await this.notify.releaseStale();
      for (const id of await this.notify.dueIds(BATCH_SIZE)) {
        await this.notify.deliver(id);
      }
    } catch (err) {
      this.logger.warn(
        `WhatsApp retry sweep failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      this.running = false;
    }
  }
}
