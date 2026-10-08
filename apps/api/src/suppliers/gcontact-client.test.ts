import assert from "node:assert/strict";
import { test } from "node:test";
import { SupplierRequestError } from "./dhru-supplier-client";
import { GContactClient, gcontactResultLines } from "./gcontact-client";
import { parseImeiList } from "../orders/imei-list";

function fakeFetch(body: unknown, status = 200) {
  const calls: string[] = [];
  const impl = async (url: string) => {
    calls.push(url);
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
  };
  return { calls, impl };
}

const config = { baseUrl: "https://gcontact.id/api", token: "tok" };

test("lookup sends token and nomor, and formats the reply", async () => {
  const { calls, impl } = fakeFetch({
    ok: true,
    nomor: "+628123456789",
    primary_name: "Budi Santoso",
    tagcount: 3,
    tag: [
      { tag: "Budi Kantor", count: 2 },
      { tag: "Pak Budi", count: 1 },
    ],
    ewallet: [
      { provider: "gopay", registered: false, name: "" },
      { provider: "shopeepay", registered: true, name: "BUDI S" },
    ],
    whatsapp: {
      registered: true,
      name: "",
      photo: null,
      is_business: true,
      business_profile: { category: "Finance", description: "", website: "" },
    },
    searchengine: [],
    summary: "Kemungkinan bernama Budi.",
    getcontact_photo: "",
    time_taken: "17.70s",
    remaining_quota: 41,
  });
  const reply = await new GContactClient(config, impl).lookup("08123456789");
  assert.equal(calls[0], "https://gcontact.id/api?token=tok&nomor=08123456789");
  assert.deepEqual(reply, {
    ok: true,
    data: {
      remainingQuota: 41,
      lines: [
        "Nomor: +628123456789",
        "Nama: Budi Santoso",
        "Jumlah Tag: 3",
        "Tag (2)",
        "• Budi Kantor (2)",
        "• Pak Budi (1)",
        "ShopeePay: BUDI S",
        "E-Wallet lain: tidak terdaftar (GoPay)",
        "WhatsApp: terdaftar, akun bisnis (Finance)",
        "Ringkasan: Kemungkinan bernama Budi.",
      ],
    },
  });
});

test("refusals: account problems are retried, number problems are shown", async () => {
  const quota = fakeFetch({ ok: false, error: "QuotaExceeded", message: "Kuota habis." }, 403);
  assert.deepEqual(await new GContactClient(config, quota.impl).lookup("08123456789"), {
    ok: false,
    message: "Kuota habis.",
    account: true,
  });
  const invalid = fakeFetch({ ok: false, error: "InvalidNumber", message: "Nomor tidak valid." }, 400);
  assert.deepEqual(await new GContactClient(config, invalid.impl).lookup("0800"), {
    ok: false,
    message: "Nomor tidak valid.",
    account: false,
  });
  await assert.rejects(
    new GContactClient(config, fakeFetch("<html>", 502).impl).lookup("08123456789"),
    SupplierRequestError,
  );
});

test("checkToken treats a missing nomor as an accepted token", async () => {
  const missing = fakeFetch(
    { ok: false, error: "MissingParameter", message: 'Parameter "nomor" wajib diisi.' },
    400,
  );
  const client = new GContactClient(config, missing.impl);
  assert.deepEqual(await client.checkToken(), { ok: true });
  assert.equal(missing.calls[0], "https://gcontact.id/api?token=tok");
  const denied = fakeFetch({ ok: false, error: "Unauthorized", message: "Token tidak valid." }, 401);
  assert.deepEqual(await new GContactClient(config, denied.impl).checkToken(), {
    ok: false,
    message: "Token tidak valid.",
  });
});

test("empty lookups still read as a result", () => {
  assert.deepEqual(gcontactResultLines({ ok: true, tag: [], remaining_quota: 3 }), [
    "Data tidak ditemukan.",
  ]);
});

test("phone numbers are normalized to 08…", () => {
  assert.deepEqual(parseImeiList(["+62 812-3456-7890", "081234567891"], "phone"), {
    ok: true,
    imeis: ["081234567890", "081234567891"],
  });
  assert.equal(parseImeiList(["0212345678"], "phone").ok, false);
  assert.equal(parseImeiList(["0812"], "phone").ok, false);
});
