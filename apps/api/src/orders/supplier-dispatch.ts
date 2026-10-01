import { Injectable } from "@nestjs/common";

/**
 * Lets the payment flow wake the supplier worker the moment a supplier-routed
 * order is paid, instead of waiting for its next timer tick. The worker lives in
 * SuppliersModule, which already depends on OrdersModule, hence a plain signal.
 */
@Injectable()
export class SupplierDispatch {
  private readonly listeners = new Set<() => void>();

  onPaid(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notifyPaid() {
    for (const listener of this.listeners) listener();
  }
}
