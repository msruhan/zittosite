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

export interface Topup {
  invoiceId: string;
  amount: number;
  amountDue: number;
  status: PaymentStatus;
  qrisString: string | null;
  checkoutUrl: string | null;
  paymentChannel: string;
  expiredAt: string;
  paidAt: string | null;
  createdAt: string;
}

export type OrderChannel = "web" | "telegram";

export type UserStatus = "active" | "suspended";

export type ResultStatus = "success" | "failed";

export type FulfillmentChannel = "telegram" | "whatsapp";

export interface Service {
  id: string;
  code?: string;
  name: string;
  description: string;
  price: number;
  estimate: string;
  active: boolean;
  /** Admin panel only: where paid orders are processed. */
  fulfillmentChannel?: FulfillmentChannel;
  /** Admin panel only: operators who receive and may process this service's orders. */
  assignedAdmins?: ServiceAssignee[];
}

export interface UserServicePrice {
  serviceId: string;
  price: number;
}

export interface ServiceAssignee {
  id: string;
  username: string;
  fullName: string;
  active: boolean;
}

export interface User {
  id: string;
  username: string;
  fullName: string;
  telegramHandle: string | null;
  /** Admin Users page only: the Telegram account actually linked via login/bot. */
  telegramLinked?: { label: string; chatReady: boolean } | null;
  /** Admin Users page only: per-service overrides; missing services use the service price. */
  customPrices?: UserServicePrice[];
  /** Admin Users page only: pricing group; while set, personal prices do not apply. */
  groupId?: string | null;
  groupName?: string | null;
  creditBalance?: number;
  /** `testing` accounts order normally but are left out of statistics. */
  role?: "customer" | "testing";
  status: UserStatus;
  botAccess: boolean;
  createdAt: string;
}

export interface AdminTelegramInvite {
  /** pending = link belum dibuka; claimed = menunggu persetujuan Super Admin. */
  status: "pending" | "claimed";
  expiresAt: string;
  telegramUsername: string | null;
  telegramName: string | null;
  telegramUserId: string | null;
  claimedAt: string | null;
}

export interface Admin {
  id: string;
  username: string;
  fullName: string;
  role?: "super_admin" | "admin";
  /** Null when Telegram belum ditautkan. */
  telegramHandle: string | null;
  telegramLinked?: boolean;
  telegramInvite?: AdminTelegramInvite | null;
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
  createdByAdminId: string | null;
  createdAt: string;
}

export interface PaymentInvoice {
  invoiceId: string;
  orderId: string;
  amount: number;
  /** Part of `amount` paid from the account balance at checkout. */
  balanceUsed?: number;
  /** Amount the customer must transfer (includes the gateway's unique code). */
  amountDue?: number;
  qrisString?: string | null;
  checkoutUrl?: string | null;
  paymentChannel: string;
  paymentReference: string | null;
  paymentStatus: PaymentStatus;
  expiredAt: string;
  paidAt: string | null;
  /** Every order this invoice pays for; more than one for a bulk order. */
  orders?: Array<{ orderId: string; imei: string; status: OrderStatus }>;
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
  /** Keterangan for rejected/cancelled orders; null means none. */
  statusReason?: string | null;
  /** Placed by a testing account; excluded from statistics. */
  isTest?: boolean;
  price: number;
  assignedAdminId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Pricing group managed by Super Admin; services without a price use the default. */
export interface UserGroup {
  id: string;
  name: string;
  description: string;
  prices: UserServicePrice[];
  members: Array<{ id: string; username: string; fullName: string }>;
  createdAt: string;
}

export type RunningAdColor = "yellow" | "red" | "green" | "blue" | "white";

/** Announcement scrolled in the member portal ticker. */
export interface RunningAd {
  id: string;
  text: string;
  linkUrl: string | null;
  tag: string | null;
  tagColor: RunningAdColor;
  isActive?: boolean;
  sortOrder?: number;
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
