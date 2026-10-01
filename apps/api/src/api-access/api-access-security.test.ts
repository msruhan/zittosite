import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { apiKeyMatches, generateApiKey, KEY_PREFIX_LENGTH, looksLikeApiKey } from "./api-key-crypto";
import { RateWindow } from "./rate-window";
import {
  checkWebhookUrl,
  checkWebhookUrlSyntax,
  insecureWebhooksAllowed,
  isNonPublicIp,
  MAX_DELIVERY_ATTEMPTS,
  nextRetryDelay,
  signWebhook,
} from "./webhook-security";

test("generated keys verify against their hash only", () => {
  const { key, prefix, hash } = generateApiKey();
  assert.ok(looksLikeApiKey(key));
  assert.equal(prefix, key.slice(0, KEY_PREFIX_LENGTH));
  assert.ok(apiKeyMatches(key, hash));
  const tampered = `${key.slice(0, -1)}${key.endsWith("0") ? "1" : "0"}`;
  assert.equal(apiKeyMatches(tampered, hash), false);
  assert.equal(apiKeyMatches(generateApiKey().key, hash), false);
  assert.equal(looksLikeApiKey("al_live_short"), false);
});

test("webhook signature is HMAC-SHA256 over timestamp.body", () => {
  const expected = createHmac("sha256", "s").update('1700000000.{"a":1}').digest("hex");
  assert.equal(signWebhook("s", 1700000000, '{"a":1}'), `sha256=${expected}`);
});

test("retries back off then stop", () => {
  assert.equal(nextRetryDelay(1), 60_000);
  assert.equal(nextRetryDelay(5), 6 * 60 * 60_000);
  assert.equal(nextRetryDelay(MAX_DELIVERY_ATTEMPTS), null);
});

test("non-public addresses are detected", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"]) {
    assert.ok(isNonPublicIp(ip), ip);
  }
  for (const ip of ["8.8.8.8", "172.32.0.1", "2606:4700::1111"]) {
    assert.equal(isNonPublicIp(ip), false, ip);
  }
});

test("webhook URLs must be public https", async () => {
  assert.equal(checkWebhookUrlSyntax("http://example.com/hook").ok, false);
  assert.equal(checkWebhookUrlSyntax("https://user:pw@example.com").ok, false);
  assert.equal(checkWebhookUrlSyntax("https://localhost/hook").ok, false);
  assert.equal(checkWebhookUrlSyntax("https://192.168.0.5/hook").ok, false);
  assert.equal(checkWebhookUrlSyntax("not a url").ok, false);
  assert.equal((await checkWebhookUrl("https://shop.example/hook", async () => ["93.184.216.34"])).ok, true);
  assert.equal((await checkWebhookUrl("https://evil.example/hook", async () => ["93.184.216.34", "10.0.0.1"])).ok, false);
  assert.equal(
    (await checkWebhookUrl("https://gone.example/hook", async () => {
      throw new Error("ENOTFOUND");
    })).ok,
    false,
  );
});

test("insecure webhooks are a local-only escape hatch", async () => {
  assert.equal(checkWebhookUrlSyntax("http://127.0.0.1:9000/hook", true).ok, true);
  assert.equal(checkWebhookUrlSyntax("ftp://127.0.0.1/hook", true).ok, false);
  assert.equal((await checkWebhookUrl("http://localhost:9000/h", async () => [], true)).ok, true);
  assert.equal(insecureWebhooksAllowed({ WEBHOOK_ALLOW_INSECURE: "1", NODE_ENV: "development" }), true);
  assert.equal(insecureWebhooksAllowed({ WEBHOOK_ALLOW_INSECURE: "1", NODE_ENV: "production" }), false);
  assert.equal(insecureWebhooksAllowed({}), false);
});

test("rate window allows up to the limit per window", () => {
  const window = new RateWindow(2, 1000);
  assert.ok(window.take("k", 0));
  assert.ok(window.take("k", 10));
  assert.equal(window.blocked("k", 20), true);
  assert.equal(window.take("k", 20), false);
  assert.ok(window.take("other", 20));
  assert.ok(window.take("k", 1000));
});
