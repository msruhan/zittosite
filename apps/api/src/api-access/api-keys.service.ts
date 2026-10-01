import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { ApiKey } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  apiKeyMatches,
  generateApiKey,
  KEY_PREFIX_LENGTH,
  looksLikeApiKey,
} from "./api-key-crypto";

export const MAX_ACTIVE_KEYS = 5;
const LAST_USED_WRITE_MS = 60_000;

export type ApiCaller = {
  userId: string;
  apiKeyId: string;
  username: string;
};

function serializeKey(key: ApiKey) {
  return {
    id: key.id,
    name: key.name,
    prefix: key.keyPrefix,
    lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
    revokedAt: key.revokedAt?.toISOString() ?? null,
    createdAt: key.createdAt.toISOString(),
  };
}

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  /** Portal endpoints are only for users Super Admin granted API access. */
  async assertApiEnabled(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { apiEnabled: true, status: true, username: true },
    });
    if (!user?.apiEnabled || user.status !== "active") {
      throw new ForbiddenException("Akses API belum diaktifkan untuk akun Anda.");
    }
    return user;
  }

  async list(userId: string) {
    const user = await this.assertApiEnabled(userId);
    const keys = await this.prisma.apiKey.findMany({
      where: { userId },
      orderBy: [{ revokedAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
    });
    return { username: user.username, keys: keys.map(serializeKey) };
  }

  async create(userId: string, rawName: string | undefined) {
    await this.assertApiEnabled(userId);
    const name = String(rawName ?? "").trim();
    if (!name) throw new BadRequestException("Nama key wajib diisi.");
    const active = await this.prisma.apiKey.count({ where: { userId, revokedAt: null } });
    if (active >= MAX_ACTIVE_KEYS) {
      throw new BadRequestException(
        `Maksimal ${MAX_ACTIVE_KEYS} API key aktif. Cabut key lama terlebih dahulu.`,
      );
    }
    const generated = generateApiKey();
    const key = await this.prisma.apiKey.create({
      data: { userId, name, keyPrefix: generated.prefix, keyHash: generated.hash },
    });
    return { ...serializeKey(key), key: generated.key };
  }

  async revoke(userId: string, id: string) {
    const key = await this.prisma.apiKey.findFirst({ where: { id, userId } });
    if (!key) throw new NotFoundException("API key tidak ditemukan.");
    if (key.revokedAt) return serializeKey(key);
    return serializeKey(
      await this.prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } }),
    );
  }

  /** The caller behind a Dhru username + key, or null for any mismatch. */
  async authenticate(username: string, rawKey: string): Promise<ApiCaller | null> {
    if (!username || !looksLikeApiKey(rawKey)) return null;
    const key = await this.prisma.apiKey.findUnique({
      where: { keyPrefix: rawKey.slice(0, KEY_PREFIX_LENGTH) },
      include: { user: { select: { username: true, status: true, apiEnabled: true } } },
    });
    if (!key || !apiKeyMatches(rawKey, key.keyHash)) return null;
    if (key.revokedAt || key.user.username !== username) return null;
    if (key.user.status !== "active" || !key.user.apiEnabled) return null;
    if (!key.lastUsedAt || Date.now() - key.lastUsedAt.getTime() > LAST_USED_WRITE_MS) {
      await this.prisma.apiKey.update({
        where: { id: key.id },
        data: { lastUsedAt: new Date() },
      });
    }
    return { userId: key.userId, apiKeyId: key.id, username: key.user.username };
  }
}
