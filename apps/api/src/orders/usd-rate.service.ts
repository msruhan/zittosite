import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { DEFAULT_USD_RATE, USD_RATE_KEY, usdCentsToIdr } from "./usd-pricing";

@Injectable()
export class UsdRateService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<number> {
    const row = await this.prisma.systemSetting.findUnique({ where: { key: USD_RATE_KEY } });
    const rate = Number(row?.value);
    return Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_USD_RATE;
  }

  /** Saves the rate and reprices every USD-priced Layanan Spesial in Rupiah. */
  async set(rate: number, actorId: string): Promise<{ rate: number; repriced: number }> {
    const services = await this.prisma.service.findMany({
      where: {
        fulfillmentChannel: "supplier",
        menu: "special",
        OR: [{ priceUsdCents: { not: null } }, { costUsdCents: { not: null } }],
      },
      select: { id: true, priceUsdCents: true, costUsdCents: true },
    });
    await this.prisma.$transaction([
      this.prisma.systemSetting.upsert({
        where: { key: USD_RATE_KEY },
        create: { key: USD_RATE_KEY, value: rate, updatedBy: actorId },
        update: { value: rate, updatedBy: actorId },
      }),
      ...services.map((service) =>
        this.prisma.service.update({
          where: { id: service.id },
          data: {
            ...(service.priceUsdCents !== null
              ? { price: usdCentsToIdr(service.priceUsdCents, rate) }
              : {}),
            ...(service.costUsdCents !== null
              ? { costPrice: usdCentsToIdr(service.costUsdCents, rate) }
              : {}),
          },
        }),
      ),
    ]);
    return { rate, repriced: services.length };
  }
}
