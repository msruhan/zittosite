import assert from "node:assert/strict";
import { test } from "node:test";
import { resultNoteLines } from "./result-note";
import { userOrderNoticeHtml } from "./telegram-messages";

const ISPIDER_REPLY =
  'Model: iPhone 12 128GB Blue A2404 China<br>IMEI Number: 357001184891312<br>Locked Carrier: Unlock<br>SIM-Lock Status: <span style="color:green ">Unlocked</span><br>';

const INFOCEIR_HISTORY = [
  "Result: 5 entries",
  "2026-07-17 13:43:07",
  "2026-07-17 13:43:07 · add_roamer · SF8080",
  "2025-12-29 01:03:39 · remove_roamer · auto-remove-operation",
  "2025-09-29 12:24:08",
  "2025-09-29 12:24:08 · add_roamer · PREPAID_IMEI_REG_WNA_XLAxiata",
].join("\n");

test("HTML supplier replies become plain lines", () => {
  assert.deepEqual(resultNoteLines(ISPIDER_REPLY), [
    "Model: iPhone 12 128GB Blue A2404 China",
    "IMEI Number: 357001184891312",
    "Locked Carrier: Unlock",
    "SIM-Lock Status: 🟢 Unlocked",
  ]);
  assert.deepEqual(resultNoteLines("A &amp; B<br/>&lt;ok&gt;"), ["A & B", "<ok>"]);
});

test("tables, lists, font colors and JSON replies become plain lines", () => {
  assert.deepEqual(
    resultNoteLines(
      '<table><tr><th>Model</th><td>iPhone 11</td></tr><tr><td>Status</td><td><font color="red">Blacklisted</font></td></tr><tr><td>a</td><td>b</td><td>c</td></tr></table>',
    ),
    ["Model: iPhone 11", "Status: 🔴 Blacklisted", "a · b · c"],
  );
  assert.deepEqual(resultNoteLines("<b>Result</b><ul><li>One &amp; two</li><li>Three</li></ul>"), [
    "Result",
    "• One & two",
    "• Three",
  ]);
  assert.deepEqual(resultNoteLines('{"message":"successfully"}'), ["Message: successfully"]);
  assert.deepEqual(resultNoteLines('{"status":"success","order_id":123,"data":{"x":1}}'), [
    "Status: success",
    "Order id: 123",
  ]);
  assert.deepEqual(resultNoteLines("Carrier: AT&amp;T"), ["Carrier: AT&T"]);
});

test("history replies drop the duplicated bare timestamps", () => {
  assert.deepEqual(resultNoteLines(INFOCEIR_HISTORY), [
    "Result: 3 entries",
    "2026-07-17 13:43:07 · add_roamer · SF8080",
    "2025-12-29 01:03:39 · remove_roamer · auto-remove-operation",
    "2025-09-29 12:24:08 · add_roamer · PREPAID_IMEI_REG_WNA_XLAxiata",
  ]);
  assert.deepEqual(resultNoteLines("2026-01-01 10:00:00\nResult: ok"), [
    "2026-01-01 10:00:00",
    "Result: ok",
  ]);
});

test("done notice shows multi-line results as a quote block", () => {
  const html = userOrderNoticeHtml({
    kind: "done",
    orderId: "ZT2610060071",
    imei: "357001184891312",
    serviceName: "Check Carrier",
    resultStatus: "success",
    note: ISPIDER_REPLY,
  } as Parameters<typeof userOrderNoticeHtml>[0]);
  assert.match(html, /📝 <b>Catatan:<\/b>\n<blockquote><b>Model:<\/b> iPhone 12/);
  assert.match(html, /<b>SIM-Lock Status:<\/b> 🟢 Unlocked<\/blockquote>/);
  assert.doesNotMatch(html, /&lt;br&gt;|&lt;span/);

  const history = userOrderNoticeHtml({
    kind: "done",
    orderId: "ZT2610040008",
    imei: "1",
    resultStatus: "success",
    note: INFOCEIR_HISTORY,
  } as Parameters<typeof userOrderNoticeHtml>[0]);
  assert.match(history, /<b>Result:<\/b> 3 entries\n• 2026-07-17 13:43:07 · add_roamer · SF8080/);

  const single = userOrderNoticeHtml({
    kind: "done",
    orderId: "X",
    imei: "1",
    resultStatus: "success",
    note: "Order selesai diproses.",
  } as Parameters<typeof userOrderNoticeHtml>[0]);
  assert.match(single, /📝 <b>Catatan:<\/b> Order selesai diproses\./);
});
