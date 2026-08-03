import * as bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function hash(password: string) {
  return bcrypt.hash(password, 10);
}

async function main() {
  const admins = [
    {
      username: "superadmin",
      password: "admin123",
      fullName: "Pusdatik Admin",
      role: "super_admin" as const,
    },
    {
      username: "operator",
      password: "admin123",
      fullName: "Operator Telegram",
      role: "admin" as const,
    },
  ];

  const users = [
    {
      username: "fajri",
      password: "user1234",
      fullName: "Muhammad Al Fajri",
      telegramHandle: "@alfajri",
      customPrice: null as number | null,
      creditBalance: 25,
      botAccess: true,
    },
    {
      username: "siti.aminah",
      password: "user1234",
      fullName: "Siti Aminah",
      telegramHandle: "@sitiaminah",
      customPrice: 170_000,
      creditBalance: 10,
      botAccess: true,
    },
    {
      username: "agus123",
      password: "user1234",
      fullName: "Agus Setiawan",
      telegramHandle: "@agussetiawan",
      customPrice: null,
      creditBalance: 5,
      botAccess: true,
    },
  ];

  const services = [
    {
      code: "activation",
      name: "Aktivasi IMEI",
      description:
        "Mendaftarkan IMEI perangkat agar dapat digunakan pada jaringan seluler dalam negeri.",
      price: 150_000,
      estimate: "1–3 jam",
      active: true,
    },
    {
      code: "register",
      name: "Registrasi IMEI Baru",
      description:
        "Pendaftaran perangkat yang belum pernah tercatat, termasuk pengecekan kelayakan.",
      price: 185_000,
      estimate: "2–6 jam",
      active: true,
    },
    {
      code: "check",
      name: "Cek Status IMEI",
      description:
        "Pemeriksaan status pendaftaran perangkat tanpa mengubah data apa pun.",
      price: 35_000,
      estimate: "±15 menit",
      active: true,
    },
    {
      code: "unlock",
      name: "Buka Blokir IMEI",
      description:
        "Pengajuan pembukaan blokir untuk perangkat yang sudah tercatat namun terkunci.",
      price: 275_000,
      estimate: "1–2 hari kerja",
      active: false,
    },
  ];

  for (const admin of admins) {
    await prisma.admin.upsert({
      where: { username: admin.username },
      create: {
        username: admin.username,
        passwordHash: await hash(admin.password),
        fullName: admin.fullName,
        role: admin.role,
        status: "active",
      },
      update: {
        passwordHash: await hash(admin.password),
        fullName: admin.fullName,
        role: admin.role,
        status: "active",
      },
    });
  }

  for (const user of users) {
    await prisma.user.upsert({
      where: { username: user.username },
      create: {
        username: user.username,
        passwordHash: await hash(user.password),
        fullName: user.fullName,
        telegramHandle: user.telegramHandle,
        customPrice: user.customPrice,
        creditBalance: user.creditBalance,
        botAccess: user.botAccess,
        status: "active",
      },
      update: {
        passwordHash: await hash(user.password),
        fullName: user.fullName,
        telegramHandle: user.telegramHandle,
        customPrice: user.customPrice,
        creditBalance: user.creditBalance,
        botAccess: user.botAccess,
        status: "active",
      },
    });
  }

  for (const service of services) {
    await prisma.service.upsert({
      where: { code: service.code },
      create: service,
      update: {
        name: service.name,
        description: service.description,
        price: service.price,
        estimate: service.estimate,
        active: service.active,
      },
    });
  }

  const fajri = await prisma.user.findUniqueOrThrow({
    where: { username: "fajri" },
  });
  const activation = await prisma.service.findUniqueOrThrow({
    where: { code: "activation" },
  });
  const check = await prisma.service.findUniqueOrThrow({
    where: { code: "check" },
  });

  const sampleOrders = [
    {
      orderId: "ZT2608030001",
      imei: "356938035643809",
      status: "waiting_action" as const,
      serviceId: activation.id,
      price: activation.price,
      notes: "Seed — sudah lunas, antrean admin",
      paid: true,
    },
    {
      orderId: "ZT2608030002",
      imei: "354827091223418",
      status: "waiting_payment" as const,
      serviceId: check.id,
      price: check.price,
      notes: null,
      paid: false,
    },
    {
      orderId: "ZT2608020001",
      imei: "351902447718203",
      status: "cancel" as const,
      serviceId: activation.id,
      price: activation.price,
      notes: "Seed — invoice kedaluwarsa",
      paid: false,
      expired: true,
    },
  ];

  for (const sample of sampleOrders) {
    const existing = await prisma.order.findUnique({
      where: { orderId: sample.orderId },
    });
    if (existing) continue;

    const expiredAt = sample.expired
      ? new Date(Date.now() - 60_000)
      : new Date(Date.now() + 30 * 60_000);

    await prisma.order.create({
      data: {
        orderId: sample.orderId,
        userId: fajri.id,
        serviceId: sample.serviceId,
        channel: "web",
        imei: sample.imei,
        notes: sample.notes,
        status: sample.status,
        price: sample.price,
        invoice: {
          create: {
            invoiceId: `INV-${sample.orderId}`,
            amount: sample.price,
            paymentChannel: "qris_placeholder",
            paymentStatus: sample.paid
              ? "paid"
              : sample.expired
                ? "expired"
                : "pending",
            expiredAt,
            paidAt: sample.paid ? new Date() : null,
            paymentReference: sample.paid ? "SEED-PAID" : null,
          },
        },
        activity: {
          create: sample.paid
            ? [
                {
                  status: "waiting_payment",
                  note: "Order dibuat lewat website. Invoice QRIS diterbitkan.",
                  actor: fajri.fullName,
                },
                {
                  status: "paid",
                  note: "Pembayaran diterima dan diverifikasi.",
                  actor: "Sistem",
                },
                {
                  status: "waiting_action",
                  note: "Order masuk antrean dan siap diambil admin.",
                  actor: "Sistem",
                },
              ]
            : sample.expired
              ? [
                  {
                    status: "waiting_payment",
                    note: "Order dibuat lewat website. Invoice QRIS diterbitkan.",
                    actor: fajri.fullName,
                  },
                  {
                    status: "cancel",
                    note: "Batas waktu pembayaran terlewat, order dibatalkan otomatis.",
                    actor: "Sistem",
                  },
                ]
              : [
                  {
                    status: "waiting_payment",
                    note: "Order dibuat lewat website. Invoice QRIS diterbitkan.",
                    actor: fajri.fullName,
                  },
                ],
        },
      },
    });
  }

  console.log("Seed OK");
  console.log("  superadmin / admin123  (Super Admin)");
  console.log("  operator / admin123    (Admin operator)");
  console.log("  fajri / user1234       (User)");
  console.log("  siti.aminah / user1234 (User)");
  console.log("  agus123 / user1234     (User)");
  console.log("  services + sample orders for fajri");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
