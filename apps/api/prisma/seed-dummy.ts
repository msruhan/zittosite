/**
 * Local dummy data: a supplier pointing at scripts/mock-supplier.ts and one
 * service for every channel/menu/input combination. Safe to re-run (upserts).
 *
 *   npm run mock:supplier   (separate terminal)
 *   npm run seed:dummy
 */
import { existsSync } from "node:fs";
import { PrismaClient, type Prisma } from "@prisma/client";
import { encryptSupplierKey } from "../src/suppliers/supplier-secret";
import { DEFAULT_USD_RATE, USD_RATE_KEY, usdCentsToIdr } from "../src/orders/usd-pricing";
import {
  MOCK_SUPPLIER_API_KEY,
  MOCK_SUPPLIER_GROUPS,
  MOCK_SUPPLIER_USERNAME,
} from "../scripts/mock-supplier";

for (const file of [".env", "../../.env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

const prisma = new PrismaClient();

const SUPPLIER_NAME = "Dummy Supplier (local)";
const SUPPLIER_URL = `http://localhost:${process.env.MOCK_SUPPLIER_PORT ?? 4100}`;

type DummyService = {
  code: string;
  name: string;
  description: string;
  estimate: string;
  fulfillmentChannel: "telegram" | "whatsapp" | "supplier";
  /** IDR, for non-special services. */
  price?: number;
  costPrice?: number;
  supplierServiceId?: string;
  menu?: "ceir" | "special";
  /** Layanan Spesial only. */
  usd?: { price: number; cost: number };
  group?: string;
  inputType?: "imei" | "sn" | "ecid" | "none";
  requireQnt?: boolean;
  requireEmail?: boolean;
  requireUsername?: boolean;
  assignOperator?: boolean;
};

const SERVICES: DummyService[] = [
  {
    code: "dummy-tg-aktivasi",
    name: "[Dummy] Aktivasi IMEI (Telegram)",
    description: "Diproses operator lewat Telegram. Untuk uji alur manual.",
    estimate: "1–3 jam",
    fulfillmentChannel: "telegram",
    price: 150_000,
    costPrice: 100_000,
    assignOperator: true,
  },
  {
    code: "dummy-wa-roamercheck",
    name: "[Dummy] Roamercheck (WhatsApp)",
    description: "Diteruskan ke grup WhatsApp Roamercheck.",
    estimate: "±15 menit",
    fulfillmentChannel: "whatsapp",
    price: 35_000,
    costPrice: 20_000,
  },
  {
    code: "dummy-ceir-status",
    name: "[Dummy] CEIR Status Check",
    description: "Cek status IMEI di CEIR lewat supplier dummy.",
    estimate: "Instant",
    fulfillmentChannel: "supplier",
    supplierServiceId: "101",
    menu: "ceir",
    price: 15_000,
    costPrice: 8_500,
  },
  {
    code: "dummy-ceir-history",
    name: "[Dummy] CEIR Full History",
    description: "Status CEIR lengkap dengan riwayat IMSI.",
    estimate: "1–5 menit",
    fulfillmentChannel: "supplier",
    supplierServiceId: "102",
    menu: "ceir",
    price: 30_000,
    costPrice: 20_400,
  },
  {
    code: "dummy-fmi-ipad-8",
    name: "[Dummy] FMI OFF iPad By SN - iPad 8th Gen",
    description: "FMI OFF iPad WiFy, proses instan. Kirim SN perangkat.",
    estimate: "Instant",
    fulfillmentChannel: "supplier",
    supplierServiceId: "201",
    menu: "special",
    usd: { price: 11_900, cost: 11_100 },
    group: "[Dummy] FMI OFF iPad WiFi",
    inputType: "sn",
  },
  {
    code: "dummy-fmi-ipad-9",
    name: "[Dummy] FMI OFF iPad By SN - iPad 9th Gen",
    description: "FMI OFF iPad WiFy, proses instan. Kirim SN perangkat.",
    estimate: "Instant",
    fulfillmentChannel: "supplier",
    supplierServiceId: "202",
    menu: "special",
    usd: { price: 13_500, cost: 12_600 },
    group: "[Dummy] FMI OFF iPad WiFi",
    inputType: "sn",
  },
  {
    code: "dummy-fmi-ipad-air4",
    name: "[Dummy] FMI OFF iPad By SN - iPad Air 4",
    description: "FMI OFF iPad WiFy, proses 1–2 hari kerja. Kirim SN perangkat.",
    estimate: "1–2 Hari Kerja",
    fulfillmentChannel: "supplier",
    supplierServiceId: "203",
    menu: "special",
    usd: { price: 15_600, cost: 14_600 },
    group: "[Dummy] FMI OFF iPad WiFi",
    inputType: "sn",
  },
  {
    code: "dummy-fmi-ipad-pro-ecid",
    name: "[Dummy] FMI OFF iPad By ECID - iPad Pro 11\" M4",
    description: "FMI OFF berdasarkan ECID perangkat.",
    estimate: "Instant",
    fulfillmentChannel: "supplier",
    supplierServiceId: "204",
    menu: "special",
    usd: { price: 24_000, cost: 23_100 },
    group: "[Dummy] FMI OFF iPad WiFi",
    inputType: "ecid",
  },
  {
    code: "dummy-server-credit",
    name: "[Dummy] Tool Credit Top Up",
    description: "Tanpa IMEI. Isi Username, Email, dan Qnt kredit.",
    estimate: "5–30 menit",
    fulfillmentChannel: "supplier",
    supplierServiceId: "301",
    menu: "special",
    usd: { price: 250, cost: 200 },
    group: "[Dummy] Server Services",
    inputType: "none",
    requireQnt: true,
    requireEmail: true,
    requireUsername: true,
  },
  {
    code: "dummy-server-activation",
    name: "[Dummy] Account Activation (Email)",
    description: "Tanpa IMEI. Aktivasi akun berdasarkan email.",
    estimate: "1–6 jam",
    fulfillmentChannel: "supplier",
    supplierServiceId: "302",
    menu: "special",
    usd: { price: 600, cost: 500 },
    group: "[Dummy] Server Services",
    inputType: "none",
    requireEmail: true,
  },
  {
    code: "dummy-imei-report-email",
    name: "[Dummy] IMEI Repair Report + Email",
    description: "IMEI wajib, laporan dikirim ke email.",
    estimate: "1–2 jam",
    fulfillmentChannel: "supplier",
    supplierServiceId: "303",
    menu: "special",
    usd: { price: 420, cost: 350 },
    group: "[Dummy] Server Services",
    inputType: "imei",
    requireEmail: true,
  },
];

async function main() {
  const rateRow = await prisma.systemSetting.findUnique({ where: { key: USD_RATE_KEY } });
  const rate = Number(rateRow?.value) > 0 ? Number(rateRow!.value) : DEFAULT_USD_RATE;
  const remoteCount = MOCK_SUPPLIER_GROUPS.reduce((n, g) => n + g.services.length, 0);

  const existingSupplier = await prisma.supplier.findFirst({ where: { name: SUPPLIER_NAME } });
  const supplierData = {
    name: SUPPLIER_NAME,
    baseUrl: SUPPLIER_URL,
    username: MOCK_SUPPLIER_USERNAME,
    apiKeyEnc: encryptSupplierKey(MOCK_SUPPLIER_API_KEY),
    isActive: true,
    remoteServiceCount: remoteCount,
  };
  const supplier = existingSupplier
    ? await prisma.supplier.update({ where: { id: existingSupplier.id }, data: supplierData })
    : await prisma.supplier.create({ data: supplierData });

  const groupIds = new Map<string, string>();
  for (const name of new Set(SERVICES.flatMap((s) => (s.group ? [s.group] : [])))) {
    const group = await prisma.serviceGroup.upsert({ where: { name }, create: { name }, update: {} });
    groupIds.set(name, group.id);
  }

  const operator = await prisma.admin.findUnique({ where: { username: "operator" } });

  for (const s of SERVICES) {
    const supplierRouted = s.fulfillmentChannel === "supplier";
    const data = {
      name: s.name,
      description: s.description,
      estimate: s.estimate,
      active: true,
      fulfillmentChannel: s.fulfillmentChannel,
      price: s.usd ? usdCentsToIdr(s.usd.price, rate) : s.price!,
      costPrice: s.usd ? usdCentsToIdr(s.usd.cost, rate) : (s.costPrice ?? 0),
      priceUsdCents: s.usd?.price ?? null,
      costUsdCents: s.usd?.cost ?? null,
      supplierId: supplierRouted ? supplier.id : null,
      supplierServiceId: supplierRouted ? s.supplierServiceId! : null,
      menu: s.menu ?? "ceir",
      serviceGroupId: s.group ? groupIds.get(s.group)! : null,
      inputType: s.inputType ?? "imei",
      requireQnt: s.requireQnt ?? false,
      requireEmail: s.requireEmail ?? false,
      requireUsername: s.requireUsername ?? false,
    } satisfies Prisma.ServiceUncheckedUpdateInput;

    const service = await prisma.service.upsert({
      where: { code: s.code },
      create: { code: s.code, ...data },
      update: data,
    });
    if (s.assignOperator && operator) {
      await prisma.serviceAssignment.upsert({
        where: { serviceId_adminId: { serviceId: service.id, adminId: operator.id } },
        create: { serviceId: service.id, adminId: operator.id },
        update: {},
      });
    }
  }

  console.log("Dummy seed OK");
  console.log(`  Supplier: ${SUPPLIER_NAME} → ${SUPPLIER_URL} (${remoteCount} layanan remote)`);
  console.log(`  ${SERVICES.length} layanan [Dummy] (kurs USD Rp${rate.toLocaleString("id-ID")})`);
  console.log("  Jalankan `npm run mock:supplier` agar order supplier diproses.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
