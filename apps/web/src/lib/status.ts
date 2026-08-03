import type { OrderStatus, PaymentStatus, ResultStatus } from "./types";

/**
 * Status stamps — soft-fill craft (NextAdmin table badges): pastel wash +
 * ink text. Most have no visible border; exit states use an outline.
 */
export interface StatusStamp {
  label: string;
  /** Tailwind classes for the badge fill/text/border. */
  stamp: string;
  /** Fill for the stepper disc and other solid marks. */
  solid: string;
  /** One line explaining what this state means to the person reading it. */
  meaning: string;
}

export const ORDER_STATUS: Record<OrderStatus, StatusStamp> = {
  waiting_payment: {
    label: "Waiting Payment",
    stamp: "bg-hold-wash text-hold-ink border-transparent",
    solid: "bg-hold-edge",
    meaning: "Order sudah dibuat, menunggu pembayaran diselesaikan.",
  },
  paid: {
    label: "Paid",
    stamp: "bg-cleared-wash text-cleared-ink border-transparent",
    solid: "bg-cleared-edge",
    meaning: "Pembayaran sudah diverifikasi.",
  },
  waiting_action: {
    label: "Waiting Action",
    stamp: "bg-queued-wash text-queued-ink border-transparent",
    solid: "bg-queued-edge",
    meaning: "Sudah masuk antrean, menunggu admin mengambil order.",
  },
  in_process: {
    label: "In Process",
    stamp: "bg-working-wash text-working-ink border-transparent",
    solid: "bg-working-edge",
    meaning: "Sedang dikerjakan admin.",
  },
  done: {
    label: "Done",
    stamp: "bg-cleared-wash text-cleared-ink border-transparent",
    solid: "bg-cleared-edge",
    meaning: "Pengerjaan selesai dan hasilnya sudah tersedia.",
  },
  rejected: {
    label: "Rejected",
    stamp: "bg-refused-wash/50 text-refused-ink border-refused-ink",
    solid: "bg-refused-edge",
    meaning: "Order ditolak admin.",
  },
  cancel: {
    label: "Cancel",
    stamp: "bg-surface text-void-ink border-void-ink",
    solid: "bg-void-edge",
    meaning: "Order dibatalkan atau invoice-nya kedaluwarsa.",
  },
};

export const PAYMENT_STATUS: Record<PaymentStatus, StatusStamp> = {
  pending: {
    label: "Pending",
    stamp: "bg-hold-wash text-hold-ink border-transparent",
    solid: "bg-hold-edge",
    meaning: "Menunggu pembayaran masuk.",
  },
  paid: {
    label: "Paid",
    stamp: "bg-cleared-wash text-cleared-ink border-transparent",
    solid: "bg-cleared-edge",
    meaning: "Pembayaran diterima.",
  },
  failed: {
    label: "Failed",
    stamp: "bg-refused-wash/50 text-refused-ink border-refused-ink",
    solid: "bg-refused-edge",
    meaning: "Pembayaran gagal diproses.",
  },
  expired: {
    label: "Expired",
    stamp: "bg-surface text-void-ink border-void-ink",
    solid: "bg-void-edge",
    meaning: "Batas waktu pembayaran sudah lewat.",
  },
  cancelled: {
    label: "Cancelled",
    stamp: "bg-surface text-void-ink border-void-ink",
    solid: "bg-void-edge",
    meaning: "Invoice dibatalkan.",
  },
};

export const RESULT_STATUS: Record<ResultStatus, StatusStamp> = {
  success: {
    label: "Berhasil",
    stamp: "bg-cleared-wash text-cleared-ink border-transparent",
    solid: "bg-cleared-edge",
    meaning: "Aktivasi berhasil dan terdaftar.",
  },
  partial: {
    label: "Sebagian",
    stamp: "bg-working-wash text-working-ink border-transparent",
    solid: "bg-working-edge",
    meaning: "Sebagian permintaan berhasil, sisanya perlu tindak lanjut.",
  },
  failed: {
    label: "Gagal",
    stamp: "bg-refused-wash/50 text-refused-ink border-refused-ink",
    solid: "bg-refused-edge",
    meaning: "Aktivasi tidak berhasil.",
  },
};

/** Order of the happy path, used by the stepper and by list filters. */
export const ORDER_STATUS_FLOW = [
  "waiting_payment",
  "paid",
  "waiting_action",
  "in_process",
  "done",
] as const satisfies readonly OrderStatus[];

/** The five statuses that make up the happy path, excluding the exits. */
export type FlowStatus = (typeof ORDER_STATUS_FLOW)[number];

export const ORDER_STATUS_OPTIONS: {
  value: OrderStatus | "all";
  label: string;
}[] = [
  { value: "all", label: "Semua Status" },
  ...(
    [
      "waiting_payment",
      "paid",
      "waiting_action",
      "in_process",
      "done",
      "rejected",
      "cancel",
    ] as OrderStatus[]
  ).map((value) => ({ value, label: ORDER_STATUS[value].label })),
];

/** True when the order has left the happy path. */
export function isTerminalFailure(status: OrderStatus): boolean {
  return status === "rejected" || status === "cancel";
}
