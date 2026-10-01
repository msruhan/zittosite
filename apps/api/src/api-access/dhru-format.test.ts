import assert from "node:assert/strict";
import { test } from "node:test";
import {
  describeOrder,
  dhruError,
  dhruStatusCode,
  dhruSuccess,
  readBulkItems,
  readCredentials,
  readOrderIds,
  readParameters,
  resolveDhruAction,
  webhookEventFor,
} from "./dhru-format";

test("envelopes follow the Dhru shape", () => {
  assert.deepEqual(dhruSuccess({ A: 1 }), { SUCCESS: [{ A: 1 }], apiversion: "8.2" });
  assert.deepEqual(dhruError("Authentication failed"), {
    ERROR: [{ MESSAGE: "Authentication failed", FULL_DESCRIPTION: "Authentication failed" }],
    apiversion: "8.2",
  });
});

test("actions resolve through their aliases", () => {
  assert.equal(resolveDhruAction("placeorder"), "placeimeiorder");
  assert.equal(resolveDhruAction(" GetImeiOrder "), "orderstatus");
  assert.equal(resolveDhruAction("getserverorderbulk"), "orderstatusbulk");
  assert.equal(resolveDhruAction("deleteeverything"), null);
});

test("credentials accept aliases and a dotted full key", () => {
  assert.deepEqual(readCredentials({ username: "Budi", apiaccesskey: "al_live_x" }), {
    username: "budi",
    key: "al_live_x",
  });
  assert.deepEqual(readCredentials({ user: "budi", api_key: "budi.al_live_x" }), {
    username: "budi",
    key: "al_live_x",
  });
  assert.deepEqual(readCredentials({ username: "budi.santoso", apiaccesskey: "al_live_x" }), {
    username: "budi.santoso",
    key: "al_live_x",
  });
});

test("parameters come from XML, JSON, or flat fields", () => {
  const xml = "<PARAMETERS><ID>SVC1</ID><IMEI>356938035643809</IMEI></PARAMETERS>";
  assert.deepEqual(readParameters({ action: "placeimeiorder", parameters: xml }), {
    ID: "SVC1",
    IMEI: "356938035643809",
  });
  assert.deepEqual(readParameters({ parameters: '{"id":"SVC1","imei":"1"}' }), {
    ID: "SVC1",
    IMEI: "1",
  });
  assert.deepEqual(readParameters({ username: "u", ID: "SVC2", imei: "2" }), {
    ID: "SVC2",
    IMEI: "2",
  });
  assert.deepEqual(readParameters({ ID: "flat", parameters: "<ID>block</ID>" }).ID, "block");
});

test("CUSTOMFIELD base64 JSON fills order fields without overriding explicit ones", () => {
  const custom = Buffer.from(JSON.stringify({ IMEI: "356938035643809", network: "x" })).toString("base64");
  const params = readParameters({
    parameters: `<PARAMETERS><ID>SVC1</ID><CUSTOMFIELD>${custom}</CUSTOMFIELD></PARAMETERS>`,
  });
  assert.equal(params.ID, "SVC1");
  assert.equal(params.IMEI, "356938035643809");
  assert.equal(params.NETWORK, "x");
  assert.equal(readParameters({ IMEI: "1", CUSTOMFIELD: custom }).IMEI, "1");
  assert.equal(readParameters({ CUSTOMFIELD: "not-base64-json" }).IMEI, undefined);
});

test("bulk items and order ids", () => {
  assert.deepEqual(readBulkItems({ parameters: '[{"ID":"A","IMEI":"1"},{"id":"B","imei":"2"}]' }), [
    { ID: "A", IMEI: "1" },
    { ID: "B", IMEI: "2" },
  ]);
  assert.deepEqual(readBulkItems({ parameters: '{"1":{"ID":"A","IMEI":"1"}}' }), [
    { ID: "A", IMEI: "1" },
  ]);
  assert.deepEqual(readOrderIds({ orderid: "ORD-1" }), ["ORD-1"]);
  assert.deepEqual(readOrderIds({ parameters: "<ID>ORD-2</ID>" }), ["ORD-2"]);
  assert.deepEqual(readOrderIds({ parameters: '["ORD-1",{"ID":"ORD-3"}]' }), ["ORD-1", "ORD-3"]);
  assert.deepEqual(readOrderIds({ orderid: "ORD-1, ORD-2" }), ["ORD-1", "ORD-2"]);
});

test("status codes map order states, failed results count as rejected", () => {
  assert.equal(dhruStatusCode("waiting_action"), 0);
  assert.equal(dhruStatusCode("paid"), 0);
  assert.equal(dhruStatusCode("in_process"), 1);
  assert.equal(dhruStatusCode("rejected"), 3);
  assert.equal(dhruStatusCode("cancel"), 3);
  assert.equal(dhruStatusCode("done", "success"), 4);
  assert.equal(dhruStatusCode("done", "failed"), 3);
});

test("describeOrder puts the result or reason in CODE", () => {
  const base = { orderId: "ORD-1", imei: "1", statusReason: null, result: null };
  assert.deepEqual(
    describeOrder({ ...base, status: "done", result: { resultStatus: "success", resultNote: "Unlocked" } }),
    { status: 4, code: "Unlocked", comments: "", message: "Order completed" },
  );
  assert.deepEqual(describeOrder({ ...base, status: "rejected", statusReason: "IMEI blacklist" }), {
    status: 3,
    code: "IMEI blacklist",
    comments: "IMEI blacklist",
    message: "Order rejected",
  });
  assert.equal(
    describeOrder({ ...base, status: "done", result: { resultStatus: "failed", resultNote: "Gagal" } })
      .comments,
    "Gagal",
  );
});

test("webhook events only exist for finished orders", () => {
  assert.equal(webhookEventFor({ status: "in_process", result: null }), null);
  assert.equal(webhookEventFor({ status: "cancel", result: null }), "order.cancelled");
  assert.equal(
    webhookEventFor({ status: "done", result: { resultStatus: "failed", resultNote: "" } }),
    "order.rejected",
  );
  assert.equal(webhookEventFor({ status: "done", result: null }), "order.completed");
});
