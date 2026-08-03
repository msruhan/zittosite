import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { serializeService } from "../orders/orders.serializer";

@Injectable()
export class AdminServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const rows = await this.prisma.service.findMany({
      orderBy: { name: "asc" },
    });
    return rows.map((s) => serializeService(s));
  }

  async create(input: {
    code?: string;
    name?: string;
    description?: string;
    price?: number;
    estimate?: string;
    active?: boolean;
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

    const row = await this.prisma.service.create({
      data: {
        code,
        name,
        description,
        price,
        estimate,
        active: input.active !== false,
      },
    });
    return serializeService(row);
  }

  async update(
    id: string,
    input: {
      name?: string;
      description?: string;
      price?: number;
      estimate?: string;
      active?: boolean;
    },
  ) {
    const existing = await this.prisma.service.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Layanan tidak ditemukan.");

    const price =
      input.price !== undefined ? Number(input.price) : existing.price;
    if (!Number.isFinite(price) || price < 0) {
      throw new BadRequestException("Harga tidak valid.");
    }

    const row = await this.prisma.service.update({
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
        ...(typeof input.active === "boolean" ? { active: input.active } : {}),
      },
    });
    return serializeService(row);
  }
}
