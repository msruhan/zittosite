import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { serializeService } from "../orders/orders.serializer";

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
} satisfies Prisma.ServiceInclude;

type ServiceWithAssignments = Prisma.ServiceGetPayload<{
  include: typeof SERVICE_INCLUDE;
}>;

function serializeAdminService(service: ServiceWithAssignments) {
  return {
    ...serializeService(service),
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
    estimate?: string;
    active?: boolean;
    assignedAdminIds?: string[];
  }) {
    const code = String(input.code ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "");
    const name = String(input.name ?? "").trim();
    const description = String(input.description ?? "").trim();
    const estimate = String(input.estimate ?? "").trim() || "—";
    const price = Number(input.price);
    if (!code || !name || !description) {
      throw new BadRequestException("Code, nama, dan deskripsi wajib.");
    }
    if (!Number.isFinite(price) || price < 0) {
      throw new BadRequestException("Harga tidak valid.");
    }
    const exists = await this.prisma.service.findUnique({ where: { code } });
    if (exists) throw new ConflictException("Code layanan sudah dipakai.");
    const adminIds = await this.validOperatorIds(input.assignedAdminIds ?? []);

    const row = await this.prisma.service.create({
      data: {
        code,
        name,
        description,
        price,
        estimate,
        active: input.active !== false,
        assignments: { create: adminIds.map((adminId) => ({ adminId })) },
      },
      include: SERVICE_INCLUDE,
    });
    return serializeAdminService(row);
  }

  async update(
    id: string,
    input: {
      name?: string;
      description?: string;
      price?: number;
      estimate?: string;
      active?: boolean;
      assignedAdminIds?: string[];
    },
  ) {
    const existing = await this.prisma.service.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Layanan tidak ditemukan.");

    const price =
      input.price !== undefined ? Number(input.price) : existing.price;
    if (!Number.isFinite(price) || price < 0) {
      throw new BadRequestException("Harga tidak valid.");
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
          ...(typeof input.active === "boolean"
            ? { active: input.active }
            : {}),
        },
        include: SERVICE_INCLUDE,
      });
    });
    return serializeAdminService(row);
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
