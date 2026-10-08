import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Supplier, SupplierKind } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  checkSupplierUrl,
  DhruSupplierClient,
  SupplierRequestError,
} from "./dhru-supplier-client";
import { GCONTACT_DEFAULT_URL, GCONTACT_SERVICE, GContactClient } from "./gcontact-client";
import { decryptSupplierKey, encryptSupplierKey, maskSupplierKey } from "./supplier-secret";

type SupplierInput = {
  kind?: SupplierKind;
  name?: string;
  baseUrl?: string;
  username?: string;
  apiKey?: string;
  isActive?: boolean;
};

export function supplierClient(supplier: Supplier): DhruSupplierClient {
  return new DhruSupplierClient({
    baseUrl: supplier.baseUrl,
    username: supplier.username,
    apiKey: decryptSupplierKey(supplier.apiKeyEnc),
  });
}

export function gcontactClient(supplier: Supplier): GContactClient {
  return new GContactClient({
    baseUrl: supplier.baseUrl,
    token: decryptSupplierKey(supplier.apiKeyEnc),
  });
}

function serializeSupplier(supplier: Supplier & { _count?: { services: number } }) {
  let apiKeyHint = "••••";
  try {
    apiKeyHint = maskSupplierKey(decryptSupplierKey(supplier.apiKeyEnc));
  } catch {
    apiKeyHint = "Tidak bisa dibaca (kunci enkripsi berubah)";
  }
  return {
    id: supplier.id,
    kind: supplier.kind,
    name: supplier.name,
    baseUrl: supplier.baseUrl,
    username: supplier.username,
    apiKeyHint,
    isActive: supplier.isActive,
    lastBalance: supplier.lastBalance,
    lastCheckedAt: supplier.lastCheckedAt?.toISOString() ?? null,
    lastError: supplier.lastError,
    serviceCount: supplier._count?.services ?? 0,
    remoteServiceCount: supplier.remoteServiceCount,
    createdAt: supplier.createdAt.toISOString(),
  };
}

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const rows = await this.prisma.supplier.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { services: true } } },
    });
    return rows.map(serializeSupplier);
  }

  async create(input: SupplierInput) {
    const kind = input.kind ?? "dhru";
    const gcontact = kind === "gcontact";
    const name = input.name?.trim() ?? "";
    const baseUrl = input.baseUrl?.trim() || (gcontact ? GCONTACT_DEFAULT_URL : "");
    const username = gcontact ? "" : input.username?.trim() ?? "";
    const apiKey = input.apiKey?.trim() ?? "";
    if (gcontact && (!name || !apiKey)) {
      throw new BadRequestException("Nama dan token GContact wajib diisi.");
    }
    if (!gcontact && (!name || !baseUrl || !username || !apiKey)) {
      throw new BadRequestException("Nama, URL, username, dan API key wajib diisi.");
    }
    const urlError = checkSupplierUrl(baseUrl);
    if (urlError) throw new BadRequestException(urlError);
    const row = await this.prisma.supplier.create({
      data: {
        kind,
        name,
        baseUrl,
        username,
        apiKeyEnc: encryptSupplierKey(apiKey),
        isActive: input.isActive !== false,
      },
    });
    return serializeSupplier(row);
  }

  /** The kind is fixed at creation: services and orders depend on it. */
  async update(id: string, input: SupplierInput) {
    const existing = await this.find(id);
    if (input.baseUrl?.trim()) {
      const urlError = checkSupplierUrl(input.baseUrl);
      if (urlError) throw new BadRequestException(urlError);
    }
    const apiKey = input.apiKey?.trim();
    const row = await this.prisma.supplier.update({
      where: { id },
      data: {
        ...(input.name?.trim() ? { name: input.name.trim() } : {}),
        ...(input.baseUrl?.trim() ? { baseUrl: input.baseUrl.trim() } : {}),
        ...(input.username?.trim() && existing.kind === "dhru"
          ? { username: input.username.trim() }
          : {}),
        ...(apiKey ? { apiKeyEnc: encryptSupplierKey(apiKey) } : {}),
        ...(typeof input.isActive === "boolean" ? { isActive: input.isActive } : {}),
      },
      include: { _count: { select: { services: true } } },
    });
    return serializeSupplier(row);
  }

  async remove(id: string) {
    const supplier = await this.find(id);
    const inUse = await this.prisma.service.count({ where: { supplierId: id } });
    if (inUse > 0) {
      throw new ConflictException(
        `Supplier masih dipakai ${inUse} layanan. Ubah jalur proses layanan tersebut dulu.`,
      );
    }
    await this.prisma.supplier.delete({ where: { id } });
    return supplier;
  }

  /** accountinfo + imeiservicelist; stores balance, offered service count, or the error. */
  async test(id: string) {
    const supplier = await this.find(id);
    let lastError: string | null = null;
    let lastBalance = supplier.lastBalance;
    let remoteServiceCount = supplier.remoteServiceCount;
    try {
      if (supplier.kind === "gcontact") {
        const reply = await gcontactClient(supplier).checkToken();
        if (reply.ok) remoteServiceCount = 1;
        else lastError = reply.message;
        return await this.saveCheck(id, { lastBalance, lastError, remoteServiceCount });
      }
      const client = supplierClient(supplier);
      const reply = await client.accountInfo();
      if (reply.ok) {
        lastBalance = [reply.data.credit, reply.data.currency].filter(Boolean).join(" ");
        const list = await client.serviceList();
        if (list.ok) remoteServiceCount = list.data.length;
        else lastError = `Saldo terbaca, tetapi daftar layanan gagal: ${list.message}`;
      } else {
        lastError = reply.message;
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
    return this.saveCheck(id, { lastBalance, lastError, remoteServiceCount });
  }

  private async saveCheck(
    id: string,
    check: { lastBalance: string | null; lastError: string | null; remoteServiceCount: number | null },
  ) {
    const row = await this.prisma.supplier.update({
      where: { id },
      data: { ...check, lastCheckedAt: new Date() },
      include: { _count: { select: { services: true } } },
    });
    return serializeSupplier(row);
  }

  async remoteServices(id: string) {
    const supplier = await this.find(id);
    if (supplier.kind === "gcontact") return [GCONTACT_SERVICE];
    try {
      const reply = await supplierClient(supplier).serviceList();
      if (!reply.ok) throw new BadGatewayException(`Supplier: ${reply.message}`);
      return reply.data;
    } catch (err) {
      if (err instanceof SupplierRequestError) throw new BadGatewayException(err.message);
      throw err;
    }
  }

  private async find(id: string) {
    const supplier = await this.prisma.supplier.findUnique({ where: { id } });
    if (!supplier) throw new NotFoundException("Supplier tidak ditemukan.");
    return supplier;
  }
}
