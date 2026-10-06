import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkSupplierUrl,
  DhruSupplierClient,
  parseServiceList,
  SupplierRequestError,
  supplierEndpoint,
} from "./dhru-supplier-client";
import { decryptSupplierKey, encryptSupplierKey, maskSupplierKey } from "./supplier-secret";
import {
  isErrorReply,
  isRetryableSupplierError,
  submitRetryDelayMs,
} from "./supplier-worker.service";

process.env.ADMIN_JWT_SECRET ??= "test-admin-secret-0123456789abcdefghijklmnop";

type Call = { url: string; form: URLSearchParams };

function fakeFetch(reply: unknown, status = 200) {
  const calls: Call[] = [];
  const impl = async (url: string, init: RequestInit) => {
    calls.push({ url, form: new URLSearchParams(String(init.body)) });
    return new Response(typeof reply === "string" ? reply : JSON.stringify(reply), { status });
  };
  return { calls, impl };
}

const config = { baseUrl: "https://supplier.test/", username: "reseller", apiKey: "KEY-123" };

test("endpoint and URL checks", () => {
  assert.equal(supplierEndpoint("https://a.test/"), "https://a.test/api/index.php");
  assert.equal(supplierEndpoint("https://a.test/dhru/index.php"), "https://a.test/dhru/index.php");
  assert.equal(checkSupplierUrl("https://a.test"), null);
  assert.equal(checkSupplierUrl("http://localhost:4000"), null);
  assert.ok(checkSupplierUrl("ftp://a.test"));
  assert.ok(checkSupplierUrl("https://u:p@a.test"));
  assert.ok(checkSupplierUrl("not a url"));
});

test("placeOrder sends Dhru form fields with IMEI and base64 CUSTOMFIELD", async () => {
  const { calls, impl } = fakeFetch({ SUCCESS: [{ MESSAGE: "ok", REFERENCEID: "R-77" }] });
  const reply = await new DhruSupplierClient(config, impl).placeOrder("SVC9", "356938035643809");
  assert.deepEqual(reply, { ok: true, data: { referenceId: "R-77" } });
  const { url, form } = calls[0]!;
  assert.equal(url, "https://supplier.test/api/index.php");
  assert.equal(form.get("username"), "reseller");
  assert.equal(form.get("apiaccesskey"), "KEY-123");
  assert.equal(form.get("action"), "placeimeiorder");
  const params = form.get("parameters")!;
  assert.match(params, /<ID>SVC9<\/ID>/);
  assert.match(params, /<IMEI>356938035643809<\/IMEI>/);
  const custom = /<CUSTOMFIELD>([^<]+)<\/CUSTOMFIELD>/.exec(params)![1]!;
  assert.deepEqual(JSON.parse(Buffer.from(custom, "base64").toString()), { IMEI: "356938035643809" });
});

test("placeOrder without a device value sends QNT top-level and extras in CUSTOMFIELD", async () => {
  const { calls, impl } = fakeFetch({ SUCCESS: [{ MESSAGE: "ok", REFERENCEID: "R-78" }] });
  await new DhruSupplierClient(config, impl).placeOrder("SVC5", null, {
    QNT: "3",
    USERNAME: "budi",
    EMAIL: "budi@example.com",
  });
  const params = calls[0]!.form.get("parameters")!;
  assert.doesNotMatch(params, /<IMEI>/);
  assert.match(params, /<QNT>3<\/QNT>/);
  const custom = /<CUSTOMFIELD>([^<]+)<\/CUSTOMFIELD>/.exec(params)![1]!;
  assert.deepEqual(JSON.parse(Buffer.from(custom, "base64").toString()), {
    QNT: "3",
    USERNAME: "budi",
    EMAIL: "budi@example.com",
  });
});

test("Dhru ERROR is a supplier decision, transport problems throw", async () => {
  const refused = fakeFetch({ ERROR: [{ MESSAGE: "Invalid IMEI" }] });
  assert.deepEqual(await new DhruSupplierClient(config, refused.impl).placeOrder("1", "2"), {
    ok: false,
    message: "Invalid IMEI",
  });
  await assert.rejects(
    new DhruSupplierClient(config, fakeFetch("<html>", 200).impl).accountInfo(),
    SupplierRequestError,
  );
  await assert.rejects(
    new DhruSupplierClient(config, fakeFetch({}, 502).impl).accountInfo(),
    SupplierRequestError,
  );
  const down = async () => {
    throw new Error("ECONNREFUSED");
  };
  await assert.rejects(new DhruSupplierClient(config, down).orderStatus("R"), SupplierRequestError);
});

test("status, account info, and service list parsing", async () => {
  const status = fakeFetch({ SUCCESS: [{ STATUS: "4", CODE: "Unlocked", COMMENTS: "" }] });
  assert.deepEqual(await new DhruSupplierClient(config, status.impl).orderStatus("R-1"), {
    ok: true,
    data: { status: 4, code: "Unlocked", comments: "" },
  });
  const account = fakeFetch({ SUCCESS: [{ AccoutInfo: { credit: "1000", currency: "IDR", mail: "a@b" } }] });
  assert.deepEqual(await new DhruSupplierClient(config, account.impl).accountInfo(), {
    ok: true,
    data: { credit: "1000", currency: "IDR", mail: "a@b" },
  });
  assert.deepEqual(
    parseServiceList({
      G1: {
        GROUPNAME: "Carrier",
        SERVICES: { "12": { SERVICEID: "12", SERVICENAME: "Check", CREDIT: "15000.50", TIME: "1h" } },
      },
      bad: null,
    }),
    [{ id: "12", name: "Check", group: "Carrier", credit: 15000.5, time: "1h", info: "" }],
  );
});

test("supplier keys round-trip encrypted and are masked", () => {
  const enc = encryptSupplierKey("cb_live_abcdef0123456789");
  assert.notEqual(enc, "cb_live_abcdef0123456789");
  assert.equal(decryptSupplierKey(enc), "cb_live_abcdef0123456789");
  assert.equal(maskSupplierKey("cb_live_abcdef0123456789"), "cb_liv••••6789");
});

test("retry policy", () => {
  assert.equal(isRetryableSupplierError("Insufficient credit"), true);
  assert.equal(isRetryableSupplierError("Invalid IMEI"), false);
  assert.equal(submitRetryDelayMs(1), 60_000);
  assert.equal(submitRetryDelayMs(3), 240_000);
});

test("completed replies carrying an error are recognised", () => {
  for (const text of [
    "Error: IMEI not supported",
    "Result: ERROR",
    "Check failed, try again later",
    "Gagal cek IMEI",
    "Invalid IMEI",
    "Adjusted by admin — credits refunded.",
  ]) {
    assert.equal(isErrorReply(text), true, text);
  }
  for (const text of [
    "Result: UNKNOWN",
    "Result: REGISTERED",
    "Result: ROAMER",
    "Order successfully",
    "Registration successfully",
    '{"message":"successfully"}',
    "5 credits added to a@b.co",
    "Result: 5 entries 2026-07-17 · add_roamer · SF8080 · remove_roamer · auto-remove-operation",
  ]) {
    assert.equal(isErrorReply(text), false, text);
  }
});
