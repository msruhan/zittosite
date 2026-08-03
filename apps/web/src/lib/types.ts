/**
 * Domain types mirroring the data model in frontend.md §10.
 * The mock layer satisfies these same shapes so swapping in the real
 * NestJS API does not change a single component.
 */

export type OrderStatus =
  | "waiting_payment"
  | "paid"
  | "waiting_action"
  | "in_process"
  | "done"
  | "rejected"
  | "cancel";

export type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "expired"
  | "cancelled";

export type OrderChannel = "web" | "telegram";

export type UserStatus = "active" | "suspended";

export type ResultStatus = "success" | "partial" | "failed";

export interface Service {
  id: string;
  code?: string;
  name: string;
  description: string;
  price: number;
  estimate: string;
  active: boolean;
}

export interface User {
  id: string;
  username: string;
  fullName: string;
  telegramHandle: string | null;
  customPrice: number | null;
  creditBalance?: number;
  status: UserStatus;
  botAccess: boolean;
  createdAt: string;
}

export interface Admin {
  id: string;
  username: string;
  fullName: string;
  role?: "super_admin" | "admin";
  /** Null when Telegram belum ditautkan. */
  telegramHandle: string | null;
  active: boolean;
  handledCount: number;
  totpEnabled?: boolean;
  createdAt?: string;
}

export interface OrderResult {
  id: string;
  orderId: string;
  resultStatus: ResultStatus;
  resultNote: string;
  resultData: Record<string, string> | null;
  createdByAdminId: string;
  createdAt: string;
}

export interface PaymentInvoice {
  invoiceId: string;
  orderId: string;
  amount: number;
  paymentChannel: string;
  paymentReference: string | null;
  paymentStatus: PaymentStatus;
  expiredAt: string;
  paidAt: string | null;
}

export interface OrderActivityLog {
  id: string;
  orderId: string;
  status: OrderStatus;
  note: string;
  actor: string;
  createdAt: string;
}

export interface Order {
  id: string;
  orderId: string;
  userId: string;
  serviceId: string;
  channel: OrderChannel;
  imei: string;
  notes: string | null;
  status: OrderStatus;
  price: number;
  assignedAdminId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** An order joined with the records a screen needs to render it. */
export interface OrderDetail extends Order {
  service: Service;
  user: User | null;
  assignedAdmin: Admin | null;
  invoice: PaymentInvoice | null;
  result: OrderResult | null;
  activity: OrderActivityLog[];
}
