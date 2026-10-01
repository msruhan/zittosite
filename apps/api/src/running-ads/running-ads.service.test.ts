import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeLinkUrl } from "./running-ads.service";

test("ad links accept internal paths and http(s) URLs", () => {
  assert.equal(normalizeLinkUrl("/app/topup"), "/app/topup");
  assert.equal(normalizeLinkUrl(" https://t.me/zittobot "), "https://t.me/zittobot");
  assert.equal(normalizeLinkUrl(""), null);
  assert.equal(normalizeLinkUrl(null), null);
  assert.equal(normalizeLinkUrl(undefined), undefined);
});

test("ad links reject script and protocol-relative URLs", () => {
  assert.throws(() => normalizeLinkUrl("javascript:alert(1)"));
  assert.throws(() => normalizeLinkUrl("//evil.example"));
  assert.throws(() => normalizeLinkUrl("data:text/html,hi"));
  assert.throws(() => normalizeLinkUrl("not a url"));
});
