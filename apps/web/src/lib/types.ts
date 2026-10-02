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

export type OrderChannel = "web" | "telegram" | "api";

export const ORDER_CHANNEL_LABEL: Record<OrderChannel, string> = {
  web: "Website",
  telegram: "Telegram",
  api: "API",
};

export type UserStatus = "active" | "suspended";

export type ResultStatus = "success" | "failed";

export type FulfillmentChannel = "telegram" | "whatsapp" | "supplier";

export type ServiceMenu = "ceir" | "special";

export const SERVICE_MENU_LABEL: Record<ServiceMenu, string> = {
  ceir: "Order Ceir",
  special: "Layanan Spesial",
};

/** Admin-defined group of Layanan Spesial services. */
export interface ServiceGroup {
  id: string;
  name: string;
  serviceIds: string[];
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  baseUrl: string;
  username: string;
  apiKeyHint: string;
  isActive: boolean;
  lastBalance: string | null;
  lastCheckedAt: string | null;
  lastError: string | null;
  /** Local services routed to this supplier. */
  serviceCount: number;
  /** Services the supplier offered at the last sync; null before the first sync. */
  remoteServiceCount: number | null;
  createdAt: string;
}

export interface SupplierRemoteService {
  id: string;
  name: string;
  group: string;
  credit: number;
  time: string;
  info: string;
}

export interface Service {
  id: string;
  code?: string;
  name: string;
  description: string;
  price: number;
  /** Admin panel only: harga modal per order. */
  costPrice?: number;
  estimate: string;
  active: boolean;
  /** "supplier" services run automatically via Supplier API; the rest go to the regular Order menu. */
  via?: "supplier" | "manual";
  /** User menu of a supplier service (Order Ceir or Layanan Spesial); null for manual services. */
  menu?: ServiceMenu | null;
  /** User service list only: Layanan Spesial group name, used as a heading in the picker. */
  group?: string | null;
  /** Layanan Spesial USD price in cents; `price` is its Rupiah value at the current rate. */
  priceUsdCents?: number | null;
  /** Admin panel only: Layanan Spesial USD cost in cents. */
  costUsdCents?: number | null;
  /** Admin panel only: Layanan Spesial group membership. */
  serviceGroupId?: string | null;
  serviceGroupName?: string | null;
  /** What the user enters per order; SN/ECID only for Layanan Spesial. */
  inputType?: "imei" | "sn" | "ecid";
  /** Admin panel only: where paid orders are processed. */
  fulfillmentChannel?: FulfillmentChannel;
  /** Admin panel only: upstream supplier route when fulfillmentChannel is "supplier". */
  supplierId?: string | null;
  supplierServiceId?: string | null;
  supplierName?: string | null;
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
  /** Granted by Super Admin: may create API keys and order through the Dhru API. */
  apiEnabled?: boolean;
  createdAt: string;
}

export interface ApiKey {
  id: string;
  name: string;
  /** First characters of the key, safe to display. */
  prefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface WebhookEndpoint {
  url: string;
  isActive: boolean;
  failureCount: number;
  lastStatus: "success" | "failed" | null;
  lastDeliveryAt: string | null;
  createdAt: string;
}

export interface WebhookDelivery {
  id: string;
  orderId: string;
  event: string;
  status: "pending" | "success" | "failed";
  attempts: number;
  responseCode: number | null;
  lastError: string | null;
  nextAttemptAt: string | null;
  createdAt: string;
  updatedAt: string;
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
  /** Admin panel only: set when the order was forwarded to a supplier. */
  supplier?: {
    name: string;
    reference: string | null;
    error: string | null;
    attempts: number;
  } | null;
}
