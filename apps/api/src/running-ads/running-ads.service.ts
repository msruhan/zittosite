import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export const RUNNING_AD_COLORS = ["yellow", "red", "green", "blue", "white"] as const;
export type RunningAdColor = (typeof RUNNING_AD_COLORS)[number];

export type RunningAdInput = {
  text?: string;
  linkUrl?: string | null;
  tag?: string | null;
  tagColor?: RunningAdColor;
  isActive?: boolean;
};

/** Internal paths (`/app/...`) or http(s) URLs only, so a link can never run script. */
export function normalizeLinkUrl(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.protocol === "https:" || url.protocol === "http:") return url.toString();
  } catch {
    // fall through
  }
  throw new BadRequestException("Link harus diawali https:// atau / (halaman internal).");
}

function cleanTag(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  const trimmed = (value ?? "").trim().toUpperCase();
  return trimmed || null;
}

@Injectable()
export class RunningAdsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.runningAd.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
  }

  listActive() {
    return this.prisma.runningAd.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      take: 20,
      select: { id: true, text: true, linkUrl: true, tag: true, tagColor: true },
    });
  }

  async create(input: RunningAdInput) {
    const text = (input.text ?? "").trim();
    if (!text) throw new BadRequestException("Teks wajib diisi.");
    const last = await this.prisma.runningAd.findFirst({ orderBy: { sortOrder: "desc" } });
    return this.prisma.runningAd.create({
      data: {
        text,
        linkUrl: normalizeLinkUrl(input.linkUrl) ?? null,
        tag: cleanTag(input.tag) ?? null,
        tagColor: input.tagColor ?? "yellow",
        isActive: input.isActive ?? true,
        sortOrder: (last?.sortOrder ?? 0) + 10,
      },
    });
  }

  async update(id: string, input: RunningAdInput) {
    await this.findOrThrow(id);
    const text = input.text === undefined ? undefined : input.text.trim();
    if (text === "") throw new BadRequestException("Teks wajib diisi.");
    return this.prisma.runningAd.update({
      where: { id },
      data: {
        text,
        linkUrl: normalizeLinkUrl(input.linkUrl),
        tag: cleanTag(input.tag),
        tagColor: input.tagColor,
        isActive: input.isActive,
      },
    });
  }

  /** Swap sort position with the neighbour above (`up`) or below (`down`). */
  async move(id: string, direction: "up" | "down") {
    const ads = await this.list();
    const index = ads.findIndex((ad) => ad.id === id);
    if (index === -1) throw new NotFoundException("Ads tidak ditemukan.");
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= ads.length) return this.list();
    const reordered = [...ads];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    await this.prisma.$transaction(
      reordered.map((ad, i) =>
        this.prisma.runningAd.update({ where: { id: ad.id }, data: { sortOrder: (i + 1) * 10 } }),
      ),
    );
    return this.list();
  }

  async remove(id: string) {
    await this.findOrThrow(id);
    return this.prisma.runningAd.delete({ where: { id } });
  }

  private async findOrThrow(id: string) {
    const ad = await this.prisma.runningAd.findUnique({ where: { id } });
    if (!ad) throw new NotFoundException("Ads tidak ditemukan.");
    return ad;
  }
}
