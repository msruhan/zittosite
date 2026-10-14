import assert from "node:assert/strict";
import { test } from "node:test";
import {
  confirmOrderText,
  isMenuKeyword,
  mainMenu,
  parseChoice,
  whatsappMenuSections,
  type WaService,
} from "./customer-bot-menu";
import { parseWhatsappNumber, whatsappChatId } from "../whatsapp/whatsapp-number";
import { telegramHtmlToWhatsapp } from "../whatsapp/whatsapp-format";
import { userOrderNoticeHtml } from "../telegram/telegram-messages";
import type { UserMenus } from "../orders/user-menus";

const menus = {
  order: { label: "Order", enabled: true },
  menus: [
    { slug: "ceir", label: "Cek CEIR", style: "ceir" },
    { slug: "spesial", label: "Layanan Spesial", style: "special" },
  ],
} as unknown as UserMenus;

const service = (code: string, menu: string | null, inputType = "imei"): WaService => ({
  code,
  name: code.toUpperCase(),
  price: 10_000,
  inputType,
  menu: menu ? { slug: menu } : null,
});

test("WhatsApp menu offers Order IMEI and CEIR services with IMEI input only", () => {
  const sections = whatsappMenuSections(
    [
      service("b-fast", null),
      service("a-fast", null),
      service("sn-only", null, "sn"),
      service("status", "ceir"),
      service("spesial", "spesial"),
    ],
    menus,
  );
  assert.deepEqual(
    sections.map((s) => [s.title, s.services.map((x) => x.code)]),
    [
      ["📱 Order IMEI", ["a-fast", "b-fast"]],
      ["🔎 Cek CEIR", ["status"]],
    ],
  );

  const menu = mainMenu("Budi", sections);
  assert.deepEqual(menu.entries, [
    { kind: "service", code: "a-fast" },
    { kind: "service", code: "b-fast" },
    { kind: "service", code: "status" },
    { kind: "history" },
    { kind: "account" },
  ]);
  assert.match(menu.text, /\n3\. STATUS — Rp10\.000\n/);
  assert.match(menu.text, /\n4\. Riwayat Order Saya\n5\. Akun & Informasi\n/);

  const disabled = whatsappMenuSections([service("a", null)], {
    ...menus,
    order: { label: "Order", enabled: false },
  });
  assert.deepEqual(disabled, []);
});

test("menu choices and keywords", () => {
  assert.equal(parseChoice(" 2 ", 5), 2);
  assert.equal(parseChoice("2.", 5), 2);
  assert.equal(parseChoice("6", 5), null);
  assert.equal(parseChoice("0", 5), null);
  assert.equal(parseChoice("dua", 5), null);
  assert.equal(isMenuKeyword("MENU"), true);
  assert.equal(isMenuKeyword("0"), true);
  assert.equal(isMenuKeyword("menu dong"), false);
});

test("order confirmation lists the IMEIs, total and quoted description", () => {
  const text = confirmOrderText({
    serviceName: "3B Fast",
    price: 50_000,
    imeis: ["350000000000001", "350000000000002"],
    description: "Wajib iCloud off\nProses 1x24 jam",
  });
  assert.match(text, /IMEI \(2\)/);
  assert.match(text, /Total:\* Rp100\.000/);
  assert.match(text, /> Wajib iCloud off\n> Proses 1x24 jam/);
});

test("Telegram HTML notices convert to WhatsApp markup", () => {
  assert.equal(
    telegramHtmlToWhatsapp(userOrderNoticeHtml({ kind: "expired", orderId: "ORD-1" })),
    [
      "⌛ *Order dibatalkan otomatis*",
      "",
      "🎫 *Order ID:* `ORD-1`",
      "",
      "Batas waktu pembayaran sudah habis.",
      "Ketik MENU untuk membuat order baru.",
    ].join("\n"),
  );
  assert.equal(
    telegramHtmlToWhatsapp(
      '<blockquote>a\nb</blockquote>\n<a href="https://x.id">Portal</a> &amp; &lt;ok&gt;',
    ),
    "> a\n> b\nPortal (https://x.id) & <ok>",
  );
});

test("WhatsApp number registration format", () => {
  assert.equal(parseWhatsappNumber(undefined), undefined);
  assert.equal(parseWhatsappNumber(""), null);
  assert.equal(parseWhatsappNumber("0812-3456-7890"), "6281234567890");
  assert.equal(parseWhatsappNumber("+62 812 3456 7890"), "6281234567890");
  assert.throws(() => parseWhatsappNumber("12345"));
  assert.equal(whatsappChatId("6281234567890"), "6281234567890@c.us");
});
