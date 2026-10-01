import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { whatsappConfig } from "../config/env";
import { formatWib, paidInvoiceGroupText } from "./whatsapp-messages";
import { backoffMs, MAX_ATTEMPTS, shouldGiveUp } from "./whatsapp-retry-policy";

const paidAt = new Date("2026-09-30T07:05:00Z");

test("single order message", () => {
  const text = paidInvoiceGroupText({
    paidAt,
    orders: [{ imei: "356938035643809" }],
  });
  assert.equal(
    text,
    [
      "✅ *PEMBAYARAN DITERIMA*",
      "",
      "🕒 Dibayar: 30 Sep 2026, 14:05 WIB",
      "",
      "1. `356938035643809`",
    ].join("\n"),
  );
});

test("bulk order numbers every IMEI without service names", () => {
  const orders = Array.from({ length: 6 }, (_, i) => ({ imei: `35693803564380${i}` }));
  const text = paidInvoiceGroupText({ paidAt, orders });
  assert.match(text, /WIB\n\n1\. `356938035643800`/);
  assert.match(text, /6\. `356938035643805`$/);
  assert.doesNotMatch(text, /📦/);
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
