import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { FulfillmentChannel, Prisma, ServiceMenu } from "@prisma/client";
import { whatsappConfig } from "../config/env";
import { PrismaService } from "../prisma/prisma.service";
import { WahaClient } from "../whatsapp/waha.client";
import { serializeService } from "../orders/orders.serializer";
import {
  type ExtraFieldFlags,
  type ServiceInputType,
  NO_EXTRA_FIELDS,
  hasExtraFields,
  parseServiceInputType,
} from "../orders/special-fields";
import { isSpecialService } from "../orders/supplier-routed";
import { usdCentsToIdr } from "../orders/usd-pricing";
import { UsdRateService } from "../orders/usd-rate.service";
import { type PriceAdjustment, adjustedPrice, adjustmentError } from "./service-group-pricing";
import { sanitizeDescription } from "./rich-description";

function serializeGroup(group: {
  id: string;
  name: string;
  createdAt: Date;
  services: Array<{ id: string }>;
}) {
  return {
    id: group.id,
    name: group.name,
    serviceIds: group.services.map((service) => service.id),
    createdAt: group.createdAt.toISOString(),
  };
}

const SERVICE_INCLUDE = {
  assignments: {
    include: {
      admin: {
        select: {
          id: true,
          username: true,
          fullName: true,
          status: true,
          role: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  },
  supplier: { select: { id: true, name: true } },
  serviceGroup: { select: { id: true, name: true } },
} satisfies Prisma.ServiceInclude;

type SupplierRoute = { supplierId?: string | null; supplierServiceId?: string | null };

const WHATSAPP_GROUP_ID = /^[\d-]+@g\.us$/;

/** Group for `whatsapp_admin` services (required); cleared for every other channel. */
export function whatsappGroupFor(
  channel: FulfillmentChannel,
  input: string | null | undefined,
  existing?: string | null,
): string | null {
  if (channel !== "whatsapp_admin") return null;
  const id = (input === undefined ? existing : input)?.trim() || "";
  if (!id) throw new BadRequestException("Pilih grup WhatsApp untuk jalur WhatsApp Admin.");
  if (!WHATSAPP_GROUP_ID.test(id)) throw new BadRequestException("ID grup WhatsApp tidak valid.");
  if (id === whatsappConfig()?.groupChatId) {
    throw new BadRequestException("Grup Roamercheck tidak bisa dipakai untuk WhatsApp Admin.");
  }
  return id;
}

/** Short card title for `whatsapp_admin` services; empty means the card shows the service name. */
export function whatsappSlugFor(
  channel: FulfillmentChannel,
  input: string | null | undefined,
  existing?: string | null,
): string | null {
  if (channel !== "whatsapp_admin") return null;
  const slug = (input === undefined ? existing : input)?.replace(/\s+/g, " ").trim();
  return slug || null;
}

/** Layanan Spesial only; ignored (and cleared) for every other service. */
type UsdPrices = { priceUsdCents?: number; costUsdCents?: number };

/** SN/ECID/none are only for Layanan Spesial; regular and Ceir services always take an IMEI. */
function inputTypeFor(
  service: { fulfillmentChannel: FulfillmentChannel; menu: ServiceMenu },
  requested: unknown,
  current: ServiceInputType = "imei",
): ServiceInputType {
  if (!isSpecialService(service)) return "imei";
  if (requested === undefined) return current;
  const type = parseServiceInputType(requested);
  if (!type) {
    throw new BadRequestException("Jenis input harus IMEI, SN, ECID, IMEI/SN, Nomor HP, atau tidak ada.");
  }
  return type;
}

type ExtraFieldInput = Partial<ExtraFieldFlags>;

/** Extra order fields are Layanan Spesial only; a service without a device value needs at least one. */
function extraFieldsFor(
  service: { fulfillmentChannel: FulfillmentChannel; menu: ServiceMenu },
  inputType: ServiceInputType,
  requested: ExtraFieldInput,
  current: ExtraFieldFlags = NO_EXTRA_FIELDS,
): ExtraFieldFlags {
  if (!isSpecialService(service)) return NO_EXTRA_FIELDS;
  const flags: ExtraFieldFlags = {
    requireQnt: requested.requireQnt ?? current.requireQnt,
    requireEmail: requested.requireEmail ?? current.requireEmail,
    requireUsername: requested.requireUsername ?? current.requireUsername,
    requireNotes: requested.requireNotes ?? current.requireNotes,
    requirePassword: requested.requirePassword ?? current.requirePassword,
    requireKeyLock: requested.requireKeyLock ?? current.requireKeyLock,
    requireSignInPicture: requested.requireSignInPicture ?? current.requireSignInPicture,
  };
  if (inputType === "none" && !hasExtraFields(flags)) {
    throw new BadRequestException(
      "Layanan tanpa IMEI/SN/ECID harus mewajibkan minimal satu field: Qnt, Email, Username, Password, Key Lock, Picture on sign-in page, atau Notes.",
    );
  }
  return flags;
}

type ServiceWithAssignments = Prisma.ServiceGetPayload<{
  include: typeof SERVICE_INCLUDE;
}>;

/** A hidden service is never orderable, and switching one online unhides it. */
export function availabilityFor(input: {
  active?: boolean;
  hidden?: boolean;
}): { active?: boolean; hidden?: boolean } {
  if (input.hidden === true) return { active: false, hidden: true };
  if (input.active === true) return { active: true, hidden: false };
  return {
    ...(input.active === false ? { active: false } : {}),
    ...(input.hidden === false ? { hidden: false } : {}),
  };
}

function serializeAdminService(service: ServiceWithAssignments) {
  return {
    ...serializeService(service),
    costPrice: service.costPrice,
    fulfillmentChannel: service.fulfillmentChannel,
    whatsappGroupId: service.whatsappGroupId,
    whatsappSlug: service.whatsappSlug,
    supplierId: service.supplierId,
    supplierServiceId: service.supplierServiceId,
    supplierName: service.supplier?.name ?? null,
    menu: service.menu,
    priceUsdCents: service.priceUsdCents,
    costUsdCents: service.costUsdCents,
    serviceGroupId: service.serviceGroupId,
    serviceGroupName: service.serviceGroup?.name ?? null,
    assignedAdmins: service.assignments.map(({ admin }) => ({
      id: admin.id,
      username: admin.username,
      fullName: admin.fullName,
      active: admin.status === "active",
    })),
  };
}

@Injectable()
export class AdminServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usdRate: UsdRateService,
    private readonly waha: WahaClient,
  ) {}

  /** Groups the bot is in that can take WhatsApp Admin cards (not the Roamercheck group). */
  async whatsappGroups() {
    if (!this.waha.enabled()) {
      throw new ServiceUnavailableException("WhatsApp (WAHA) belum dikonfigurasi.");
    }
    let groups;
    try {
      groups = await this.waha.listGroups();
    } catch {
      throw new ServiceUnavailableException("Gagal mengambil daftar grup dari WhatsApp. Coba lagi.");
    }
    const roamercheck = whatsappConfig()?.groupChatId;
    return groups.filter((group) => group.id !== roamercheck);
  }

  private async usdPricing(priceUsdCents: number, costUsdCents: number) {
    const rate = await this.usdRate.get();
    return {
      priceUsdCents,
      costUsdCents,
      price: usdCentsToIdr(priceUsdCents, rate),
      costPrice: usdCentsToIdr(costUsdCents, rate),
    };
  }

  async list() {
    const rows = await this.prisma.service.findMany({
      orderBy: { name: "asc" },
      include: SERVICE_INCLUDE,
    });
    return rows.map(serializeAdminService);
  }

  async create(input: {
    code?: string;
    name?: string;
    description?: string;
    price?: number;
    costPrice?: number;
    estimate?: string;
    active?: boolean;
    hidden?: boolean;
    fulfillmentChannel?: FulfillmentChannel;
    whatsappGroupId?: string | null;
    whatsappSlug?: string | null;
    assignedAdminIds?: string[];
    inputType?: unknown;
    menu?: ServiceMenu;
  } & SupplierRoute & UsdPrices & ExtraFieldInput) {
    const name = String(input.name ?? "").trim();
    const description = sanitizeDescription(String(input.description ?? "")) || name;
    const estimate = String(input.estimate ?? "").trim() || "—";
    if (!name) {
      throw new BadRequestException("Nama layanan wajib.");
    }
    const code = await this.uniqueCode(input.code || name);
    const adminIds = await this.validOperatorIds(input.assignedAdminIds ?? []);
    const fulfillmentChannel = input.fulfillmentChannel ?? "telegram";
    const whatsappGroupId = whatsappGroupFor(fulfillmentChannel, input.whatsappGroupId);
    const whatsappSlug = whatsappSlugFor(fulfillmentChannel, input.whatsappSlug);
    const route = await this.supplierRoute(fulfillmentChannel, input);
    const menu = input.menu ?? "ceir";
    const inputType = await this.phoneInputFor(
      route.supplierId,
      inputTypeFor({ fulfillmentChannel, menu }, input.inputType),
    );
    const extraFields = extraFieldsFor({ fulfillmentChannel, menu }, inputType, input);
    const special = isSpecialService({ fulfillmentChannel, menu });
    if (special && input.priceUsdCents === undefined) {
      throw new BadRequestException("Harga USD wajib untuk Layanan Spesial.");
    }
    const usd = special
      ? await this.usdPricing(input.priceUsdCents!, input.costUsdCents ?? 0)
      : null;
    const price = usd ? usd.price : Number(input.price);
    if (!Number.isFinite(price) || price < 0) {
      throw new BadRequestException("Harga tidak valid.");
    }
    const costPrice = usd ? usd.costPrice : Number(input.costPrice ?? 0);
    if (!Number.isFinite(costPrice) || costPrice < 0) {
      throw new BadRequestException("Harga modal tidak valid.");
    }

    const row = await this.prisma.service.create({
      data: {
        code,
        name,
        description,
        price,
        costPrice,
        estimate,
        active: input.active !== false,
        ...availabilityFor(input),
        fulfillmentChannel,
        whatsappGroupId,
        whatsappSlug,
        ...route,
        menu,
        inputType,
        ...extraFields,
        priceUsdCents: usd?.priceUsdCents ?? null,
        costUsdCents: usd?.costUsdCents ?? null,
        assignments: { create: adminIds.map((adminId) => ({ adminId })) },
      },
      include: SERVICE_INCLUDE,
    });
    return serializeAdminService(row);
  }

  /** Orders keep a hard reference to their service, so used services can only go offline. */
  async remove(id: string) {
    const existing = await this.prisma.service.findUnique({
      where: { id },
      select: { id: true, name: true, _count: { select: { orders: true } } },
    });
    if (!existing) throw new NotFoundException("Layanan tidak ditemukan.");
    if (existing._count.orders > 0) {
      throw new ConflictException(
        `Layanan sudah punya ${existing._count.orders} order sehingga tidak bisa dihapus. Ubah statusnya ke Offline atau Sembunyikan saja agar tidak bisa dipesan.`,
      );
    }
    await this.prisma.service.delete({ where: { id } });
    return { id: existing.id, name: existing.name };
  }

  async update(
    id: string,
    input: {
      name?: string;
      description?: string;
      price?: number;
      costPrice?: number;
      estimate?: string;
      active?: boolean;
      hidden?: boolean;
      fulfillmentChannel?: FulfillmentChannel;
      whatsappGroupId?: string | null;
      whatsappSlug?: string | null;
      assignedAdminIds?: string[];
      inputType?: unknown;
      menu?: ServiceMenu;
    } & SupplierRoute & UsdPrices & ExtraFieldInput,
  ) {
    const existing = await this.prisma.service.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Layanan tidak ditemukan.");
    const fulfillmentChannel = input.fulfillmentChannel ?? existing.fulfillmentChannel;
    const whatsappGroupId = whatsappGroupFor(
      fulfillmentChannel,
      input.whatsappGroupId,
      existing.whatsappGroupId,
    );
    const whatsappSlug = whatsappSlugFor(
      fulfillmentChannel,
      input.whatsappSlug,
      existing.whatsappSlug,
    );
    const route = await this.supplierRoute(fulfillmentChannel, input, existing);
    const menu = input.menu ?? existing.menu;
    const inputType = await this.phoneInputFor(
      route.supplierId,
      inputTypeFor({ fulfillmentChannel, menu }, input.inputType, existing.inputType),
    );
    const extraFields = extraFieldsFor({ fulfillmentChannel, menu }, inputType, input, existing);
    const special = isSpecialService({ fulfillmentChannel, menu });
    const priceUsdCents = input.priceUsdCents ?? existing.priceUsdCents;
    if (special && priceUsdCents === null) {
      throw new BadRequestException("Harga USD wajib untuk Layanan Spesial.");
    }
    const usd = special
      ? await this.usdPricing(priceUsdCents!, input.costUsdCents ?? existing.costUsdCents ?? 0)
      : null;

    const price = usd
      ? usd.price
      : input.price !== undefined
        ? Number(input.price)
        : existing.price;
    if (!Number.isFinite(price) || price < 0) {
      throw new BadRequestException("Harga tidak valid.");
    }
    const costPrice = usd
      ? usd.costPrice
      : input.costPrice !== undefined
        ? Number(input.costPrice)
        : existing.costPrice;
    if (!Number.isFinite(costPrice) || costPrice < 0) {
      throw new BadRequestException("Harga modal tidak valid.");
    }
    const adminIds =
      input.assignedAdminIds !== undefined
        ? await this.validOperatorIds(input.assignedAdminIds)
        : undefined;

    const row = await this.prisma.$transaction(async (tx) => {
      if (adminIds) {
        await tx.serviceAssignment.deleteMany({
          where: { serviceId: id, adminId: { notIn: adminIds } },
        });
        await tx.serviceAssignment.createMany({
          data: adminIds.map((adminId) => ({ serviceId: id, adminId })),
          skipDuplicates: true,
        });
      }
      // Orders placed before a cost price existed would otherwise count as 100% profit.
      if (existing.costPrice === 0 && costPrice > 0) {
        await tx.order.updateMany({
          where: { serviceId: id, costPrice: 0 },
          data: { costPrice },
        });
      }
      return tx.service.update({
        where: { id },
        data: {
          ...(input.name != null ? { name: String(input.name).trim() } : {}),
          ...(input.description != null
            ? { description: sanitizeDescription(String(input.description)) }
            : {}),
          ...(input.estimate != null
            ? { estimate: String(input.estimate).trim() }
            : {}),
          price,
          costPrice,
          priceUsdCents: usd?.priceUsdCents ?? null,
          costUsdCents: usd?.costUsdCents ?? null,
          ...availabilityFor(input),
          ...(input.fulfillmentChannel
            ? { fulfillmentChannel: input.fulfillmentChannel }
            : {}),
          whatsappGroupId,
          whatsappSlug,
          ...route,
          menu,
          inputType,
          ...extraFields,
          ...(isSpecialService({ fulfillmentChannel, menu }) ? {} : { serviceGroupId: null }),
        },
        include: SERVICE_INCLUDE,
      });
    });
    return serializeAdminService(row);
  }

  async listGroups() {
    const rows = await this.prisma.serviceGroup.findMany({
      orderBy: { name: "asc" },
      include: { services: { select: { id: true } } },
    });
    return rows.map(serializeGroup);
  }

  async createGroup(input: { name?: string; serviceIds?: string[] }) {
    const name = await this.groupName(input.name);
    const serviceIds = await this.specialServiceIds(input.serviceIds ?? []);
    const row = await this.prisma.serviceGroup.create({
      data: { name, services: { connect: serviceIds.map((id) => ({ id })) } },
      include: { services: { select: { id: true } } },
    });
    return serializeGroup(row);
  }

  /** `serviceIds` replaces the membership; a service moves out of its previous group. */
  async updateGroup(id: string, input: { name?: string; serviceIds?: string[] }) {
    const existing = await this.prisma.serviceGroup.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Grup tidak ditemukan.");
    const name = input.name !== undefined ? await this.groupName(input.name, id) : undefined;
    const serviceIds =
      input.serviceIds !== undefined ? await this.specialServiceIds(input.serviceIds) : undefined;
    const row = await this.prisma.serviceGroup.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(serviceIds ? { services: { set: serviceIds.map((sid) => ({ id: sid })) } } : {}),
      },
      include: { services: { select: { id: true } } },
    });
    return serializeGroup(row);
  }

  /** Services stay; they just leave the group. */
  async removeGroup(id: string) {
    const existing = await this.prisma.serviceGroup.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Grup tidak ditemukan.");
    await this.prisma.serviceGroup.delete({ where: { id } });
    return { id: existing.id, name: existing.name };
  }

  /**
   * Bulk-edits the USD selling price of every service in the group (amounts and
   * rounding are in cents), then reprices them in Rupiah at the current rate.
   */
  async adjustGroupPrices(id: string, input: PriceAdjustment) {
    const invalid = adjustmentError(input);
    if (invalid) throw new BadRequestException(invalid);
    const group = await this.prisma.serviceGroup.findUnique({
      where: { id },
      include: {
        services: {
          select: { id: true, name: true, priceUsdCents: true, costUsdCents: true },
        },
      },
    });
    if (!group) throw new NotFoundException("Grup tidak ditemukan.");
    if (!group.services.length) throw new BadRequestException("Grup belum punya layanan.");
    const unpriced = group.services.find((service) => service.priceUsdCents === null);
    if (unpriced) {
      throw new BadRequestException(`Isi dulu harga USD layanan ${unpriced.name}.`);
    }

    const rate = await this.usdRate.get();
    const changes = group.services.map((service) => {
      const before = service.priceUsdCents!;
      const next = adjustedPrice({ price: before, costPrice: service.costUsdCents ?? 0 }, input);
      return { id: service.id, name: service.name, before, next };
    });
    const tooLow = changes.find((change) => change.next < 1);
    if (tooLow) {
      throw new BadRequestException(`Harga ${tooLow.name} menjadi di bawah $0.01.`);
    }
    await this.prisma.$transaction(
      changes.map((change) =>
        this.prisma.service.update({
          where: { id: change.id },
          data: { priceUsdCents: change.next, price: usdCentsToIdr(change.next, rate) },
        }),
      ),
    );
    return {
      groupId: group.id,
      groupName: group.name,
      changes: changes.map(({ id: serviceId, name, before, next }) => ({
        serviceId,
        name,
        beforeUsdCents: before,
        afterUsdCents: next,
      })),
    };
  }

  private async groupName(raw: unknown, ignoreId?: string): Promise<string> {
    const name = String(raw ?? "").trim();
    if (!name) throw new BadRequestException("Nama grup wajib.");
    const taken = await this.prisma.serviceGroup.findFirst({
      where: { name: { equals: name, mode: "insensitive" }, ...(ignoreId ? { NOT: { id: ignoreId } } : {}) },
      select: { id: true },
    });
    if (taken) throw new ConflictException("Nama grup sudah dipakai.");
    return name;
  }

  private async specialServiceIds(ids: string[]): Promise<string[]> {
    const unique = [...new Set(ids)];
    if (!unique.length) return [];
    const found = await this.prisma.service.findMany({
      where: { id: { in: unique }, fulfillmentChannel: "supplier", menu: "special" },
      select: { id: true },
    });
    if (found.length !== unique.length) {
      throw new BadRequestException("Grup hanya bisa berisi layanan di menu Layanan Spesial.");
    }
    return unique;
  }

  /** Supplier columns for the channel; clears them for non-supplier channels. */
  private async supplierRoute(
    channel: FulfillmentChannel,
    input: SupplierRoute,
    current: SupplierRoute = {},
  ): Promise<{ supplierId: string | null; supplierServiceId: string | null }> {
    if (channel !== "supplier") return { supplierId: null, supplierServiceId: null };
    const supplierId =
      input.supplierId !== undefined ? input.supplierId : current.supplierId ?? null;
    const supplierServiceId = (
      input.supplierServiceId !== undefined
        ? input.supplierServiceId
        : current.supplierServiceId ?? null
    )?.trim();
    if (!supplierId || !supplierServiceId) {
      throw new BadRequestException("Pilih supplier dan layanan supplier.");
    }
    const supplier = await this.prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) throw new BadRequestException("Supplier tidak ditemukan.");
    return { supplierId, supplierServiceId };
  }

  /** GContact services always take a phone number, and only they may. */
  private async phoneInputFor(
    supplierId: string | null,
    inputType: ServiceInputType,
  ): Promise<ServiceInputType> {
    const supplier = supplierId
      ? await this.prisma.supplier.findUnique({ where: { id: supplierId }, select: { kind: true } })
      : null;
    if (supplier?.kind === "gcontact") {
      if (inputType !== "phone") {
        throw new BadRequestException("Layanan GContact harus memakai jenis input Nomor HP.");
      }
      return inputType;
    }
    if (inputType === "phone") {
      throw new BadRequestException("Jenis input Nomor HP hanya untuk layanan supplier GContact.");
    }
    return inputType;
  }

  /** Slug of the requested code (or name), suffixed `-2`, `-3`, … until unused. */
  private async uniqueCode(source: string): Promise<string> {
    const base =
      source
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 34) || "layanan";
    const taken = new Set(
      (
        await this.prisma.service.findMany({
          where: { code: { startsWith: base } },
          select: { code: true },
        })
      ).map((row) => row.code),
    );
    if (!taken.has(base)) return base;
    for (let n = 2; ; n++) {
      const candidate = `${base}-${n}`;
      if (!taken.has(candidate)) return candidate;
    }
  }

  private async validOperatorIds(ids: string[]) {
    if (!ids.length) return [];
    const found = await this.prisma.admin.findMany({
      where: { id: { in: ids }, role: { in: ["admin", "super_admin"] } },
      select: { id: true },
    });
    if (found.length !== ids.length) {
      throw new BadRequestException(
        "Assign hanya bisa ke akun admin yang terdaftar.",
      );
    }
    return ids;
  }
}
