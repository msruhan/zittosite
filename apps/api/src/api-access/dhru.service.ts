import { HttpException, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { OrdersService } from "../orders/orders.service";
import { InsufficientBalanceException } from "../orders/balance";
import { INPUT_TYPE_LABEL, parseImeiList } from "../orders/imei-list";
import {
  type ExtraFieldFlags,
  NO_DEVICE_VALUE,
  type OrderExtras,
  SIGN_IN_PICTURE_FIELD,
  type ServiceInputType,
  parseOrderExtras,
} from "../orders/special-fields";
import { ApiKeysService, type ApiCaller } from "./api-keys.service";
import { RateWindow } from "./rate-window";
import {
  describeOrder,
  dhruError,
  dhruSuccess,
  readBulkItems,
  readCredentials,
  readOrderIds,
  readParameters,
  resolveDhruAction,
  type DhruResponse,
} from "./dhru-format";

export const MAX_BULK_ORDERS = 50;
export const MAX_BULK_STATUS = 100;
const REQUESTS_PER_MINUTE = 120;
const PLACEMENTS_PER_MINUTE = 20;
const AUTH_FAILURES_PER_10_MIN = 20;

type Form = Record<string, unknown>;
type ServiceRow = {
  id: string;
  code: string;
  name: string;
  price: number;
  estimate: string;
  description: string;
  inputType: ServiceInputType;
} & ExtraFieldFlags;

class DhruFailure extends Error {}

@Injectable()
export class DhruService {
  private readonly logger = new Logger(DhruService.name);
  private readonly requests = new RateWindow(REQUESTS_PER_MINUTE, 60_000);
  private readonly placements = new RateWindow(PLACEMENTS_PER_MINUTE, 60_000);
  private readonly authFailures = new RateWindow(AUTH_FAILURES_PER_10_MIN, 10 * 60_000);

  constructor(
    private readonly prisma: PrismaService,
    private readonly keys: ApiKeysService,
    private readonly orders: OrdersService,
  ) {}

  async handle(form: Form, ip: string | undefined): Promise<DhruResponse> {
    const ipKey = ip ?? "unknown";
    if (this.authFailures.blocked(ipKey)) {
      return dhruError("Too many requests", "too_many_failed_logins");
    }
    const { username, key } = readCredentials(form);
    const caller = await this.keys.authenticate(username, key);
    if (!caller) {
      this.authFailures.take(ipKey);
      return dhruError("Authentication failed", "invalid_username_or_apiaccesskey");
    }
    if (!this.requests.take(caller.apiKeyId)) {
      return dhruError("Too many requests", "rate_limited");
    }

    const action = resolveDhruAction(form.action);
    if (!action) return dhruError("Unsupported action", "unsupported_action");
    try {
      switch (action) {
        case "accountinfo":
          return await this.accountInfo(caller);
        case "imeiservicelist":
          return await this.serviceList(caller);
        case "placeimeiorder":
          return await this.placeOrder(caller, readParameters(form));
        case "placeimeiorderbulk":
          return await this.placeOrderBulk(caller, readBulkItems(form));
        case "orderstatus":
          return await this.orderStatus(caller, readOrderIds(form));
        case "orderstatusbulk":
          return await this.orderStatusBulk(caller, readOrderIds(form));
      }
    } catch (err) {
      if (err instanceof DhruFailure) return dhruError(err.message);
      this.logger.error(
        `Dhru ${action} failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}`,
      );
      return dhruError("Internal error", "internal_error");
    }
  }

  private async accountInfo(caller: ApiCaller) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: caller.userId },
      select: { creditBalance: true, username: true },
    });
    return dhruSuccess({
      message: "Your Account Info",
      AccoutInfo: {
        credit: user.creditBalance.toLocaleString("id-ID"),
        creditraw: String(user.creditBalance),
        mail: user.username,
        currency: "IDR",
        username: user.username,
      },
    });
  }

  private async services(caller: ApiCaller): Promise<ServiceRow[]> {
    return this.orders.listServices(caller.userId);
  }

  private async serviceList(caller: ApiCaller) {
    const services = await this.services(caller);
    const list = {
      "IMEI Services": {
        GROUPNAME: "IMEI Services",
        GROUPTYPE: "IMEI",
        SERVICES: Object.fromEntries(
          services.map((service) => [
            service.code,
            {
              SERVICEID: service.code,
              SERVICETYPE: "IMEI",
              SERVICENAME: service.name,
              CREDIT: String(service.price),
              TIME: service.estimate,
              INFO: service.description,
              "Requires.Network": "None",
              "Requires.Mobile": "None",
              "Requires.Provider": "None",
              "Requires.PIN": "None",
              "Requires.KBH": "None",
              "Requires.MEP": "None",
              "Requires.PRD": "None",
              "Requires.SN": service.inputType === "sn" ? "Required" : "None",
              "Requires.ECID": service.inputType === "ecid" ? "Required" : "None",
            },
          ]),
        ),
      },
    };
    return dhruSuccess({ MESSAGE: "IMEI Service List", LIST: list });
  }

  /** Validates one order line against the caller's services; throws DhruFailure. */
  private resolveLine(services: ServiceRow[], params: Record<string, string>) {
    const ref = params.ID || params.SERVICEID || "";
    const service = services.find((s) => s.code === ref.toLowerCase() || s.id === ref);
    if (!service) throw new DhruFailure("Service not found");
    const extras = parseOrderExtras(service, {
      qnt: params.QNT || params.QUANTITY,
      email: params.EMAIL,
      username: params.USERNAME,
      notes: params.NOTES || params.NOTE,
      password: params.PASSWORD,
      keyLock: params.KEYLOCK,
      signInPicture: params[SIGN_IN_PICTURE_FIELD.toUpperCase()] || params.SIGNINPICTURE,
      codeText: params.CODE,
    });
    if (!extras.ok) throw new DhruFailure(extras.errors.join(" "));
    const type = service.inputType;
    if (type === "none") return { service, imei: NO_DEVICE_VALUE, extras: extras.extras };
    const raw =
      type === "sn"
        ? params.SN || params.SERIALNUMBER || params.IMEI
        : type === "ecid"
          ? params.ECID || params.IMEI
          : type === "imei_sn"
            ? params.IMEI || params.SN || params.SERIALNUMBER
            : params.IMEI;
    const parsed = parseImeiList([raw ?? ""], type);
    if (!parsed.ok) throw new DhruFailure(`Invalid ${INPUT_TYPE_LABEL[type]}`);
    return { service, imei: parsed.imeis[0]!, extras: extras.extras };
  }

  private async create(
    caller: ApiCaller,
    serviceId: string,
    imei: string,
    extras: OrderExtras,
  ) {
    try {
      return await this.orders.createOrder(caller.userId, {
        serviceId,
        imeis: [imei],
        qnt: extras.quantity ?? undefined,
        email: extras.email ?? undefined,
        username: extras.username ?? undefined,
        notes: extras.notes ?? undefined,
        password: extras.password ?? undefined,
        keyLock: extras.keyLock ?? undefined,
        signInPicture: extras.signInPicture ?? undefined,
        codeText: extras.codeText ?? undefined,
        channel: "api",
        apiKeyId: caller.apiKeyId,
        balanceOnly: true,
      });
    } catch (err) {
      if (err instanceof InsufficientBalanceException) {
        throw new DhruFailure("Insufficient balance");
      }
      if (err instanceof HttpException && err.getStatus() < 500) {
        throw new DhruFailure(err.message);
      }
      throw err;
    }
  }

  private async placeOrder(caller: ApiCaller, params: Record<string, string>) {
    if (!this.placements.take(caller.apiKeyId)) {
      return dhruError("Too many requests", "order_rate_limited");
    }
    const { service, imei, extras } = this.resolveLine(await this.services(caller), params);
    const order = await this.create(caller, service.id, imei, extras);
    return dhruSuccess({ MESSAGE: "Order Placed Successfully", REFERENCEID: order.orderId });
  }

  private async placeOrderBulk(caller: ApiCaller, items: Record<string, string>[]) {
    if (!items.length) return dhruError("Invalid request", "parameters_required");
    if (items.length > MAX_BULK_ORDERS) {
      return dhruError(`Maximum ${MAX_BULK_ORDERS} orders per request`, "too_many_orders");
    }
    for (let i = 0; i < items.length; i++) {
      if (!this.placements.take(caller.apiKeyId)) {
        return dhruError("Too many requests", "order_rate_limited");
      }
    }
    const services = await this.services(caller);
    const lines = items.map((params) => {
      try {
        return { params, ...this.resolveLine(services, params), error: null };
      } catch (err) {
        return { params, service: null, imei: null, extras: null, error: (err as Error).message };
      }
    });
    const total = lines.reduce((sum, line) => sum + (line.service?.price ?? 0), 0);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: caller.userId },
      select: { creditBalance: true },
    });
    if (user.creditBalance < total) return dhruError("Insufficient balance");

    const results: Record<string, unknown>[] = [];
    for (const line of lines) {
      const echo = { IMEI: line.params.IMEI ?? "", ID: line.params.ID ?? line.params.SERVICEID ?? "" };
      if (!line.service || !line.imei || !line.extras) {
        results.push({ ...echo, ERROR: line.error });
        continue;
      }
      try {
        const order = await this.create(caller, line.service.id, line.imei, line.extras);
        results.push({ ...echo, MESSAGE: "Order Placed Successfully", REFERENCEID: order.orderId });
      } catch (err) {
        if (!(err instanceof DhruFailure)) throw err;
        results.push({ ...echo, ERROR: err.message });
      }
    }
    return dhruSuccess(...results);
  }

  private async findOrders(caller: ApiCaller, orderIds: string[]) {
    return this.prisma.order.findMany({
      where: { userId: caller.userId, orderId: { in: orderIds } },
      select: {
        orderId: true,
        imei: true,
        status: true,
        statusReason: true,
        result: { select: { resultStatus: true, resultNote: true } },
      },
    });
  }

  private statusItem(order: Awaited<ReturnType<DhruService["findOrders"]>>[number]) {
    const view = describeOrder(order);
    return {
      STATUS: String(view.status),
      CODE: view.code,
      COMMENTS: view.comments,
      REFERENCEID: order.orderId,
      IMEI: order.imei,
      MESSAGE: view.message,
    };
  }

  private async orderStatus(caller: ApiCaller, orderIds: string[]) {
    const id = orderIds[0];
    if (!id) return dhruError("Invalid request", "orderid_required");
    const [order] = await this.findOrders(caller, [id]);
    if (!order) return dhruError("Order not found");
    return dhruSuccess(this.statusItem(order));
  }

  private async orderStatusBulk(caller: ApiCaller, orderIds: string[]) {
    const ids = [...new Set(orderIds)];
    if (!ids.length) return dhruError("Invalid request", "orderid_required");
    if (ids.length > MAX_BULK_STATUS) {
      return dhruError(`Maximum ${MAX_BULK_STATUS} orders per request`, "too_many_orders");
    }
    const found = new Map((await this.findOrders(caller, ids)).map((o) => [o.orderId, o]));
    return dhruSuccess(
      ...ids.map((id) => {
        const order = found.get(id);
        return order ? this.statusItem(order) : { REFERENCEID: id, ERROR: "Order not found" };
      }),
    );
  }
}
