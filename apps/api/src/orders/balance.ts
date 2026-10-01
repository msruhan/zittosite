import { BadRequestException, ConflictException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

export type RefundReason = "order_rejected" | "order_cancelled" | "order_failed";

export type BalanceReason =
  | RefundReason
  | "refund_reversal"
  | "late_payment"
  | "order_payment"
  | "payment_release"
  | "admin_adjust"
  | "topup";

/** Entries whose sum is an order's outstanding refund (credits minus reversals). */
const ORDER_REFUND_REASONS: BalanceReason[] = [
  "order_rejected",
  "order_cancelled",
  "order_failed",
  "refund_reversal",
];

/**
 * Applies a signed change to the user's creditBalance and writes a ledger row.
 * Returns false (and changes nothing) when `refKey` was already applied.
 * A debit throws unless the balance covers it or `allowNegative` is set.
 */
export async function applyBalance(
  tx: Prisma.TransactionClient,
  entry: {
    userId: string;
    amount: number;
    reason: BalanceReason;
    refKey: string;
    orderId?: string;
    note: string;
  },
  opts: { allowNegative?: boolean } = {},
): Promise<boolean> {
  if (!Number.isSafeInteger(entry.amount) || entry.amount === 0) return false;
  const inserted = await tx.balanceEntry.createMany({
    data: [entry],
    skipDuplicates: true,
  });
  if (inserted.count !== 1) return false;
  if (entry.amount < 0 && !opts.allowNegative) {
    const debited = await tx.user.updateMany({
      where: { id: entry.userId, creditBalance: { gte: -entry.amount } },
      data: { creditBalance: { increment: entry.amount } },
    });
    if (debited.count !== 1) {
      throw new ConflictException("Saldo tidak cukup.");
    }
    return true;
  }
  await tx.user.update({
    where: { id: entry.userId },
    data: { creditBalance: { increment: entry.amount } },
  });
  return true;
}

async function orderRefundState(tx: Prisma.TransactionClient, orderId: string) {
  const agg = await tx.balanceEntry.aggregate({
    where: { orderId, reason: { in: ORDER_REFUND_REASONS } },
    _sum: { amount: true },
    _count: true,
  });
  return { outstanding: agg._sum.amount ?? 0, entries: agg._count };
}

type RefundableOrder = {
  id: string;
  orderId: string;
  userId: string;
  price: number;
  invoiceId: string | null;
};

/**
 * Returns a paid order's price to the customer's balance unless it is already
 * refunded. Orders whose invoice was never paid get nothing. Returns the
 * amount credited.
 */
export async function refundOrderToBalance(
  tx: Prisma.TransactionClient,
  order: RefundableOrder,
  reason: RefundReason,
): Promise<number> {
  if (!order.invoiceId) return 0;
  const invoice = await tx.paymentInvoice.findUnique({
    where: { id: order.invoiceId },
    select: { paymentStatus: true },
  });
  if (invoice?.paymentStatus !== "paid") return 0;
  const state = await orderRefundState(tx, order.id);
  if (state.outstanding > 0) return 0;
  const credited = await applyBalance(tx, {
    userId: order.userId,
    amount: order.price,
    reason,
    refKey: `order:${order.id}:${state.entries}`,
    orderId: order.id,
    note: `Refund order ${order.orderId}.`,
  });
  return credited ? order.price : 0;
}

/**
 * Takes back an order's outstanding refund when it is moved to a status that
 * no longer warrants one. May leave the balance negative if it was spent.
 * Returns the amount debited.
 */
export async function reverseOrderRefund(
  tx: Prisma.TransactionClient,
  order: RefundableOrder,
): Promise<number> {
  const state = await orderRefundState(tx, order.id);
  if (state.outstanding <= 0) return 0;
  const debited = await applyBalance(
    tx,
    {
      userId: order.userId,
      amount: -state.outstanding,
      reason: "refund_reversal",
      refKey: `order:${order.id}:${state.entries}`,
      orderId: order.id,
      note: `Refund order ${order.orderId} ditarik kembali.`,
    },
    { allowNegative: true },
  );
  return debited ? state.outstanding : 0;
}

export function refundNote(amount: number): string {
  return amount > 0
    ? ` Dana Rp${amount.toLocaleString("id-ID")} dikembalikan ke saldo akun.`
    : "";
}

export function reversalNote(amount: number): string {
  return amount > 0
    ? ` Refund Rp${amount.toLocaleString("id-ID")} ditarik dari saldo akun.`
    : "";
}

/** Signed, non-zero whole Rupiah within a sane bound for a manual adjustment. */
export function parseAdjustment(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value === 0 ||
    Math.abs(value) > 1_000_000_000
  ) {
    throw new BadRequestException("Nominal saldo tidak valid.");
  }
  return value;
}
