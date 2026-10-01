import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { FulfillmentChannel, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { serializeService } from "../orders/orders.serializer";
import { type InputType, parseInputType } from "../orders/imei-list";
import { isSpecialSupplierService } from "../orders/supplier-routed";

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
} satisfies Prisma.ServiceInclude;

type SupplierRoute = { supplierId?: string | null; supplierServiceId?: string | null };

/** SN/ECID are only for Layanan Spesial; regular and Ceir services always take an IMEI. */
function inputTypeFor(
  route: { supplierServiceId: string | null },
  requested: unknown,
  current: InputType = "imei",
): InputType {
  if (!isSpecialSupplierService(route.supplierServiceId)) return "imei";
  if (requested === undefined) return current;
  const type = parseInputType(requested);
  if (!type) throw new BadRequestException("Jenis input harus IMEI, SN, atau ECID.");
  return type;
}

type ServiceWithAssignments = Prisma.ServiceGetPayload<{
  include: typeof SERVICE_INCLUDE;
}>;

function serializeAdminService(service: ServiceWithAssignments) {
  return {
    ...serializeService(service),
    costPrice: service.costPrice,
    fulfillmentChannel: service.fulfillmentChannel,
    supplierId: service.supplierId,
    supplierServiceId: service.supplierServiceId,
    supplierName: service.supplier?.name ?? null,
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
  constructor(private readonly prisma: PrismaService) {}

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
    fulfillmentChannel?: FulfillmentChannel;
    assignedAdminIds?: string[];
    inputType?: unknown;
  } & SupplierRoute) {
    const name = String(input.name ?? "").trim();
    const description = String(input.description ?? "").trim() || name;
    const estimate = String(input.estimate ?? "").trim() || "—";
    const price = Number(input.price);
    if (!name) {
      throw new BadRequestException("Nama layanan wajib.");
    }
    if (!Number.isFinite(price) || price < 0) {
      throw new BadRequestException("Harga tidak valid.");
    }
    const costPrice = Number(input.costPrice ?? 0);
    if (!Number.isFinite(costPrice) || costPrice < 0) {
      throw new BadRequestException("Harga modal tidak valid.");
    }
    const code = await this.uniqueCode(input.code || name);
    const adminIds = await this.validOperatorIds(input.assignedAdminIds ?? []);
    const fulfillmentChannel = input.fulfillmentChannel ?? "telegram";
    const route = await this.supplierRoute(fulfillmentChannel, input);
    const inputType = inputTypeFor(route, input.inputType);

    const row = await this.prisma.service.create({
      data: {
        code,
        name,
        description,
        price,
        costPrice,
        estimate,
        active: input.active !== false,
        fulfillmentChannel,
        ...route,
        inputType,
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
        `Layanan sudah punya ${existing._count.orders} order sehingga tidak bisa dihapus. Matikan (offline) saja agar tidak bisa dipesan.`,
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
      fulfillmentChannel?: FulfillmentChannel;
      assignedAdminIds?: string[];
      inputType?: unknown;
    } & SupplierRoute,
  ) {
    const existing = await this.prisma.service.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Layanan tidak ditemukan.");
    const route = await this.supplierRoute(
      input.fulfillmentChannel ?? existing.fulfillmentChannel,
      input,
      existing,
    );
    const inputType = inputTypeFor(route, input.inputType, existing.inputType);

    const price =
      input.price !== undefined ? Number(input.price) : existing.price;
    if (!Number.isFinite(price) || price < 0) {
      throw new BadRequestException("Harga tidak valid.");
    }
    const costPrice =
      input.costPrice !== undefined
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
            ? { description: String(input.description).trim() }
            : {}),
          ...(input.estimate != null
            ? { estimate: String(input.estimate).trim() }
            : {}),
          ...(input.price !== undefined ? { price } : {}),
          ...(input.costPrice !== undefined ? { costPrice } : {}),
          ...(typeof input.active === "boolean"
            ? { active: input.active }
            : {}),
          ...(input.fulfillmentChannel
            ? { fulfillmentChannel: input.fulfillmentChannel }
            : {}),
          ...route,
          inputType,
        },
        include: SERVICE_INCLUDE,
      });
    });
    return serializeAdminService(row);
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
      where: { id: { in: ids }, role: "admin" },
      select: { id: true },
    });
    if (found.length !== ids.length) {
      throw new BadRequestException(
        "Assign hanya bisa ke akun operator yang terdaftar.",
      );
    }
    return ids;
  }
}
