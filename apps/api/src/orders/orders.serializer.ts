import type {
  Admin,
  Order,
  OrderActivityLog,
  OrderResult,
  PaymentInvoice,
  Service,
  User,
} from "@prisma/client";
import { customerActor, customerText } from "./customer-text";
import { decryptSupplierKey } from "../suppliers/supplier-secret";
import type { MenuInfo } from "./supplier-routed";

type InvoiceWithOrders = PaymentInvoice & {
  orders?: Array<Pick<Order, "orderId" | "imei" | "status">>;
};

/** Services are always loaded with their menu (`include: { menu: { select: MENU_SELECT } }`). */
export type ServiceWithMenu = Service & { menu: MenuInfo | null };

type OrderWithRelations = Order & {
  service: ServiceWithMenu;
  user: User;
  assignedAdmin: Admin | null;
  invoice: InvoiceWithOrders | null;
  result:
    | (OrderResult & {
        createdByAdmin?: Pick<Admin, "id" | "username" | "fullName"> | null;
      })
    | null;
  activity: OrderActivityLog[];
  /** Admin queries only. */
  supplier?: { name: string } | null;
};

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export function serializeMenu(menu: MenuInfo) {
  return {
    id: menu.id,
    slug: menu.slug,
    label: menu.label,
    style: menu.style,
    priceCurrency: menu.priceCurrency,
  };
}

export function serializeService(
  service: ServiceWithMenu,
  effectivePrice?: number,
) {
  return {
    id: service.id,
    code: service.code,
    name: service.name,
    description: service.description,
    price: effectivePrice ?? service.price,
    estimate: service.estimate,
    active: service.active,
    hidden: service.hidden,
    via: service.fulfillmentChannel === "supplier" ? "supplier" : "manual",
    menu:
      service.fulfillmentChannel === "supplier" && service.menu ? serializeMenu(service.menu) : null,
    inputType: service.inputType,
    requireQnt: service.requireQnt,
    requireEmail: service.requireEmail,
    requireUsername: service.requireUsername,
    requireNotes: service.requireNotes,
    requirePassword: service.requirePassword,
    requireKeyLock: service.requireKeyLock,
    requireSignInPicture: service.requireSignInPicture,
    requireCode: service.requireCode,
  };
}

export function serializeUser(user: User) {
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    telegramHandle: user.telegramHandle,
    creditBalance: user.creditBalance,
    role: user.role,
    status: user.status,
    botAccess: user.botAccess,
    apiEnabled: user.apiEnabled,
    createdAt: user.createdAt.toISOString(),
  };
}

export function serializeAdmin(admin: Admin | null) {
  if (!admin) return null;
  const handle = admin.telegramUsername?.trim();
  return {
    id: admin.id,
    username: admin.username,
    fullName: admin.fullName,
    role: admin.role,
    telegramHandle: handle
      ? handle.startsWith("@")
        ? handle
        : `@${handle}`
      : null,
    active: admin.status === "active",
    handledCount: 0,
  };
}

export function serializeInvoice(invoice: InvoiceWithOrders | null) {
  if (!invoice) return null;
  return {
    invoiceId: invoice.invoiceId,
    orderId: "", // filled by caller with public orderId
    amount: invoice.amount,
    balanceUsed: invoice.balanceUsed,
    amountDue: invoice.amountDue ?? invoice.amount - invoice.balanceUsed,
    qrisString: invoice.qrisString,
    checkoutUrl: invoice.checkoutUrl,
    paymentChannel: invoice.paymentChannel,
    paymentReference: invoice.paymentReference,
    paymentStatus: invoice.paymentStatus,
    expiredAt: invoice.expiredAt.toISOString(),
    paidAt: iso(invoice.paidAt),
    /** Every order this invoice pays for (more than one for a bulk order). */
    orders: (invoice.orders ?? []).map((o) => ({
      orderId: o.orderId,
      imei: o.imei,
      status: o.status,
    })),
  };
}

export function serializeActivity(
  log: OrderActivityLog,
  publicOrderId: string,
) {
  return {
    id: log.id,
    orderId: publicOrderId,
    status: log.status,
    note: log.note,
    actor: log.actor,
    createdAt: log.createdAt.toISOString(),
  };
}

export function serializeResult(
  result: OrderWithRelations["result"],
  publicOrderId: string,
) {
  if (!result) return null;
  return {
    id: result.id,
    orderId: publicOrderId,
    resultStatus: result.resultStatus,
    resultNote: result.resultNote,
    resultData:
      result.resultData && typeof result.resultData === "object"
        ? (result.resultData as Record<string, string>)
        : null,
    createdByAdminId: result.createdByAdminId,
    createdAt: result.createdAt.toISOString(),
  };
}

function revealPassword(passwordEnc: string | null): string | null {
  if (!passwordEnc) return null;
  try {
    return decryptSupplierKey(passwordEnc);
  } catch {
    return null;
  }
}

/**
 * Customer-facing unless `internal`: supplier wording is rewritten out of
 * reasons and activity. Admin callers pass `internal: true`.
 */
export function serializeOrderListItem(
  order: OrderWithRelations,
  opts?: { redactUser?: boolean; internal?: boolean },
) {
  const internal = opts?.internal === true;
  return {
    id: order.id,
    orderId: order.orderId,
    userId: opts?.redactUser ? null : order.userId,
    serviceId: order.serviceId,
    channel: order.channel,
    imei: order.imei,
    // The customer's own note; among admins only Super Admins (redactUser === false) see it.
    notes: !internal || opts?.redactUser === false ? order.notes : null,
    quantity: order.quantity,
    email: order.email,
    username: order.username,
    keyLock: order.keyLock,
    signInPicture: order.signInPicture,
    codeText: order.codeText,
    hasPassword: Boolean(order.passwordEnc),
    // Only admins processing the order see it; customers just get `hasPassword`.
    ...(internal ? { password: revealPassword(order.passwordEnc) } : {}),
    status: order.status,
    statusReason: internal ? order.statusReason : customerText(order.statusReason),
    isTest: order.isTest,
    price: order.price,
    assignedAdminId: order.assignedAdminId,
    startedAt: iso(order.startedAt),
    completedAt: iso(order.completedAt),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    service: serializeService(order.service),
    user: opts?.redactUser ? null : serializeUser(order.user),
    assignedAdmin: serializeAdmin(order.assignedAdmin),
    invoice: order.invoice
      ? { ...serializeInvoice(order.invoice)!, orderId: order.orderId }
      : null,
    result: serializeResult(order.result, order.orderId),
    ...(order.supplier !== undefined
      ? {
          supplier: order.supplier
            ? {
                name: order.supplier.name,
                reference: order.supplierRef,
                error: order.supplierError,
                attempts: order.supplierAttempts,
              }
            : null,
        }
      : {}),
    activity: order.activity.map((log) => {
      const raw = serializeActivity(log, order.orderId);
      const entry = internal
        ? raw
        : { ...raw, note: customerText(raw.note), actor: customerActor(raw.actor) };
      const actorIsCustomer =
        log.actor === order.user.fullName || log.actor === order.user.username;
      return opts?.redactUser && actorIsCustomer
        ? { ...entry, actor: "Customer" }
        : entry;
    }),
  };
}
