import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { whatsappConfig } from "../config/env";
import { formatWib, paidInvoiceGroupText } from "./whatsapp-messages";
import { backoffMs, MAX_ATTEMPTS, shouldGiveUp } from "./whatsapp-retry-policy";

const paidAt = new Date("2026-09-30T07:05:00Z");

test("single order message", () => {
  const text = paidInvoiceGroupText({
    username: "budi123",
    paidAt,
    orders: [{ imei: "356938035643809", serviceName: "3B Slow" }],
  });
  assert.equal(
    text,
    [
      "✅ *PEMBAYARAN DITERIMA*",
      "",
      "👤 User: *budi123*",
      "🕒 Dibayar: 30 Sep 2026, 14:05 WIB",
      "",
      "📦 *3B Slow*",
      "1. `356938035643809`",
    ].join("\n"),
  );
});

test("bulk order lists every IMEI under its service", () => {
  const orders = Array.from({ length: 6 }, (_, i) => ({
    imei: `35693803564380${i}`,
    serviceName: "Unlock",
  }));
  const text = paidInvoiceGroupText({ username: "x", paidAt, orders });
  assert.match(text, /📦 \*Unlock\*\n1\. `356938035643800`/);
  assert.match(text, /6\. `356938035643805`/);
});

test("mixed services are grouped with continuous numbering", () => {
  const text = paidInvoiceGroupText({
    username: "x",
    paidAt,
    orders: [
      { imei: "1", serviceName: "S1" },
      { imei: "2", serviceName: "S2" },
      { imei: "3", serviceName: "S1" },
    ],
  });
  assert.match(text, /📦 \*S1\*\n1\. `1`\n2\. `3`/);
  assert.match(text, /📦 \*S2\*\n3\. `2`/);
});

test("markdown markers in user text are stripped", () => {
  const text = paidInvoiceGroupText({
    username: "*evil_`user`~",
    paidAt,
    orders: [{ imei: "1", serviceName: "_Svc*" }],
  });
  assert.match(text, /👤 User: \*eviluser\*/);
  assert.match(text, /📦 \*Svc\*/);
});

test("WIB formatting", () => {
  assert.equal(formatWib(new Date("2026-01-01T17:30:00Z")), "2 Jan 2026, 00:30 WIB");
});

test("backoff schedule and attempt cap", () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5, 9].map((n) => backoffMs(n) / 60_000),
    [1, 2, 5, 10, 30, 30],
  );
  assert.equal(shouldGiveUp(MAX_ATTEMPTS - 1), false);
  assert.equal(shouldGiveUp(MAX_ATTEMPTS), true);
});

const WA_KEYS = ["WAHA_MOCK", "WAHA_BASE_URL", "WAHA_API_KEY", "WA_GROUP_CHAT_ID", "WAHA_SESSION"];
const saved = Object.fromEntries(WA_KEYS.map((k) => [k, process.env[k]]));
afterEach(() => {
  for (const k of WA_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

function setEnv(values: Record<string, string>) {
  for (const k of WA_KEYS) delete process.env[k];
  Object.assign(process.env, values);
}

test("whatsappConfig is off until base URL, key and group are all set", () => {
  setEnv({ WAHA_BASE_URL: "http://waha:3000", WAHA_API_KEY: "k" });
  assert.equal(whatsappConfig(), null);
  setEnv({ WAHA_API_KEY: "k", WA_GROUP_CHAT_ID: "1@g.us" });
  assert.equal(whatsappConfig(), null);
  setEnv({ WAHA_BASE_URL: "http://waha:3000/", WAHA_API_KEY: "k", WA_GROUP_CHAT_ID: "1@g.us" });
  assert.deepEqual(whatsappConfig(), {
    mock: false,
    baseUrl: "http://waha:3000",
    apiKey: "k",
    session: "default",
    groupChatId: "1@g.us",
  });
});

test("whatsappConfig mock mode needs nothing else", () => {
  setEnv({ WAHA_MOCK: "1" });
  assert.equal(whatsappConfig()?.mock, true);
  assert.equal(whatsappConfig()?.groupChatId, "mock@g.us");
});
